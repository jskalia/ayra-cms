import { createHash, randomBytes } from 'node:crypto'
import { getFieldsToSign, jwtSign, type Payload } from 'payload'

/**
 * Sign in with Google (OpenID Connect, authorization-code flow with PKCE).
 *
 * Google only proves who someone is. Who may get in is decided here:
 *  - an existing account (admin or approver) whose email matches Google's verified email signs in;
 *  - a verified email on an allowed domain (AYRA_GOOGLE_ALLOWED_DOMAINS, default neurocare.ai),
 *    confirmed by Google's own hosted-domain claim, gets an account created with the lowest
 *    access: the approver role and no sites, so it sees nothing until an admin assigns sites;
 *  - anyone else is refused. An admin role is never given automatically, and website and sync
 *    accounts (API keys) never sign in this way.
 * Passwords stay for admins as the way in when Google is unavailable.
 */
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export type GoogleConfig = { clientId: string; clientSecret: string; allowedDomains: string[] }

export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | undefined {
  const clientId = env.AYRA_GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.AYRA_GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return undefined
  const allowedDomains = (env.AYRA_GOOGLE_ALLOWED_DOMAINS ?? 'neurocare.ai')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
  return { clientId, clientSecret, allowedDomains }
}

/** Why a sign-in was refused, as a short code for the sign-in page. */
export type GoogleRefusal = 'not-invited' | 'unverified' | 'role' | 'failed' | 'denied' | 'not-configured' | 'origin'

const b64url = (buf: Buffer) => buf.toString('base64url')

export type Handshake = { state: string; verifier: string; nonce: string; next: string }
export const newHandshake = (next: string): Handshake => ({
  state: b64url(randomBytes(24)),
  verifier: b64url(randomBytes(48)),
  nonce: b64url(randomBytes(24)),
  next,
})

export function authUrl(cfg: GoogleConfig, redirectUri: string, h: Handshake): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: h.state,
    nonce: h.nonce,
    code_challenge: b64url(createHash('sha256').update(h.verifier).digest()),
    code_challenge_method: 'S256',
    prompt: 'select_account',
    // A hint for Google's account picker; the real check is on the returned claims.
    ...(cfg.allowedDomains.length === 1 ? { hd: cfg.allowedDomains[0] } : {}),
  })
  return `${AUTH_URL}?${q.toString()}`
}

export type GoogleClaims = { email?: string; email_verified?: boolean | string; hd?: string; name?: string; iss?: string; aud?: string; exp?: number; nonce?: string }

/**
 * Trades the code for Google's ID token. It comes straight from Google's token endpoint over TLS,
 * which OpenID Connect accepts in place of checking its signature; its claims are still checked.
 */
export async function exchangeCode(
  cfg: GoogleConfig,
  { code, redirectUri, verifier }: { code: string; redirectUri: string; verifier: string },
  doFetch: typeof fetch = fetch,
): Promise<GoogleClaims> {
  const res = await doFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier,
    }),
  })
  const body = (await res.json().catch(() => ({}))) as { id_token?: string }
  if (!res.ok || !body.id_token) throw new Error(`Google answered ${res.status} to the code exchange`)
  const payload = body.id_token.split('.')[1]
  if (!payload) throw new Error('Google sent no ID token')
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GoogleClaims
}

export type Verified = { email: string; domain: string; hd?: string; name: string }

/** The ID token must be Google's, for this app, unexpired, for this attempt, with a verified email. */
export function checkClaims(cfg: GoogleConfig, claims: GoogleClaims, nonce: string, now = Date.now()): Verified | GoogleRefusal {
  if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') return 'failed'
  if (claims.aud !== cfg.clientId) return 'failed'
  if (!claims.exp || claims.exp * 1000 < now) return 'failed'
  if (claims.nonce !== nonce) return 'failed'
  const email = claims.email?.trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) return 'failed'
  if (claims.email_verified !== true && claims.email_verified !== 'true') return 'unverified'
  return { email, domain: email.split('@')[1], hd: claims.hd?.toLowerCase(), name: (claims.name ?? '').trim() || email.split('@')[0] }
}

export type Resolved = { user: { id: number | string; role?: string | null; email: string }; created: boolean } | GoogleRefusal

/** Who this Google identity is in the CMS (see the rules above). */
export async function resolveUser(payload: Payload, cfg: GoogleConfig, who: Verified): Promise<Resolved> {
  const { docs } = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { email: { equals: who.email } } })
  const existing = docs[0] as { id: number | string; role?: string | null; email: string } | undefined
  if (existing) {
    // Website and sync accounts work with API keys only.
    return existing.role === 'admin' || existing.role === 'editor' ? { user: existing, created: false } : 'role'
  }
  // New people: only a verified address on an allowed domain, confirmed by Google's hosted-domain claim.
  if (!cfg.allowedDomains.includes(who.domain) || who.hd !== who.domain) return 'not-invited'
  const user = (await payload.create({
    collection: 'users',
    overrideAccess: true,
    // No password anyone knows: they sign in with Google. No sites until an admin assigns them.
    data: { email: who.email, name: who.name, role: 'editor', tenants: [], password: randomBytes(32).toString('base64url') } as never,
  })) as unknown as { id: number | string; role?: string | null; email: string }
  return { user, created: true }
}

/**
 * Starts a normal CMS session for this person, the way Payload's own login does (a session on the
 * account and a signed token), and returns the cookie to set. Sign-out and expiry work as usual.
 */
export async function startSession(payload: Payload, userId: number | string, now = new Date()) {
  const collection = payload.collections.users
  const auth = collection.config.auth
  const raw = (await payload.db.findOne({ collection: 'users', where: { id: { equals: userId } } })) as unknown as {
    id: number | string
    email: string
    sessions?: { id: string; createdAt: Date | string; expiresAt: Date | string }[]
  }
  const sid = randomBytes(16).toString('hex')
  const expiresAt = new Date(now.getTime() + auth.tokenExpiration * 1000)
  const live = (raw.sessions ?? []).filter((s) => new Date(s.expiresAt) > now)
  await payload.db.updateOne({
    collection: 'users', id: raw.id, returning: false,
    data: { sessions: [...live, { id: sid, createdAt: now, expiresAt }] } as never,
  })
  const { token } = await jwtSign({
    fieldsToSign: getFieldsToSign({ collectionConfig: collection.config, email: raw.email, sid, user: { ...raw, collection: 'users' } as never }),
    secret: payload.secret,
    tokenExpiration: auth.tokenExpiration,
  })
  return { token, name: `${payload.config.cookiePrefix}-token`, expires: expiresAt }
}
