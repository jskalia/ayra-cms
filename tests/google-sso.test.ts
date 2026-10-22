/**
 * Sign in with Google: who gets in (src/lib/google-sso.ts). Google itself is faked; what is
 * checked is our side: the claims, the invited-or-allowed-domain rule, the lowest-access
 * accounts it creates, and that the session it starts is a normal one.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { authUrl, checkClaims, exchangeCode, googleConfig, newHandshake, resolveUser, startSession, type GoogleClaims, type GoogleConfig, type Verified } from '../src/lib/google-sso'
import { ctx, setup, teardown } from './setup'

beforeAll(setup, 180_000)
afterAll(teardown)

const cfg: GoogleConfig = { clientId: 'client-id.apps.example.test', clientSecret: 'test-secret', allowedDomains: ['neurocare.ai'] }
const claims = (extra: Partial<GoogleClaims> = {}): GoogleClaims => ({
  iss: 'https://accounts.google.com', aud: cfg.clientId, exp: Math.floor(Date.now() / 1000) + 600, nonce: 'n1',
  email: 'New.Hire@neurocare.ai', email_verified: true, hd: 'neurocare.ai', name: 'New Hire', ...extra,
})
const verified = (extra: Partial<Verified> = {}): Verified => ({ email: 'newhire@neurocare.ai', domain: 'neurocare.ai', hd: 'neurocare.ai', name: 'New Hire', ...extra })

describe('configuration', () => {
  it('is off without both keys, and defaults to the neurocare.ai domain', () => {
    expect(googleConfig({})).toBeUndefined()
    expect(googleConfig({ AYRA_GOOGLE_CLIENT_ID: 'a' })).toBeUndefined()
    expect(googleConfig({ AYRA_GOOGLE_CLIENT_ID: 'a', AYRA_GOOGLE_CLIENT_SECRET: 'b' })?.allowedDomains).toEqual(['neurocare.ai'])
    expect(googleConfig({ AYRA_GOOGLE_CLIENT_ID: 'a', AYRA_GOOGLE_CLIENT_SECRET: 'b', AYRA_GOOGLE_ALLOWED_DOMAINS: ' A.com, b.org ' })?.allowedDomains).toEqual(['a.com', 'b.org'])
  })
  it('sends people to Google with PKCE, a state and a nonce, and never the secret', () => {
    const h = newHandshake('/blogs/2')
    const url = new URL(authUrl(cfg, 'https://cms.example.test/auth/google/callback', h))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe(h.state)
    expect(url.searchParams.get('nonce')).toBe(h.nonce)
    expect(url.searchParams.get('redirect_uri')).toBe('https://cms.example.test/auth/google/callback')
    expect(url.searchParams.get('hd')).toBe('neurocare.ai')
    expect(url.toString()).not.toContain('test-secret')
    expect(url.searchParams.get('code_challenge')).not.toBe(h.verifier)
  })
})

describe('the ID token Google returns', () => {
  it('a good one gives the lowercase email and name', () => {
    expect(checkClaims(cfg, claims(), 'n1')).toMatchObject({ email: 'new.hire@neurocare.ai', domain: 'neurocare.ai', hd: 'neurocare.ai', name: 'New Hire' })
  })
  it.each([
    ['another issuer', { iss: 'https://evil.example.test' }, 'failed'],
    ['another app’s token', { aud: 'someone-else' }, 'failed'],
    ['an expired token', { exp: 1 }, 'failed'],
    ['a token for another attempt', { nonce: 'other' }, 'failed'],
    ['no email', { email: undefined }, 'failed'],
    ['an unverified email', { email_verified: false }, 'unverified'],
  ] as const)('refuses %s', (_name, extra, code) => {
    expect(checkClaims(cfg, claims(extra as Partial<GoogleClaims>), 'n1')).toBe(code)
  })
  it('exchanges the code with the secret and the PKCE verifier, and reads the claims', async () => {
    let sent: URLSearchParams | undefined
    const idToken = `x.${Buffer.from(JSON.stringify(claims())).toString('base64url')}.y`
    const f = (async (_u: unknown, init?: RequestInit) => {
      sent = new URLSearchParams(String(init?.body))
      return Response.json({ id_token: idToken })
    }) as typeof fetch
    const got = await exchangeCode(cfg, { code: 'abc', redirectUri: 'https://cms.example.test/auth/google/callback', verifier: 'ver' }, f)
    expect(got.email).toBe('New.Hire@neurocare.ai')
    expect(Object.fromEntries(sent!)).toMatchObject({ code: 'abc', code_verifier: 'ver', client_secret: 'test-secret', grant_type: 'authorization_code' })
    await expect(exchangeCode(cfg, { code: 'abc', redirectUri: 'r', verifier: 'v' }, (async () => Response.json({}, { status: 400 })) as typeof fetch)).rejects.toThrow(/400/)
  })
})

describe('who gets in', () => {
  it('an existing account signs in by its email, whatever the case, even from another domain', async () => {
    const r = await resolveUser(ctx.payload, cfg, verified({ email: 'viewera@example.test', domain: 'example.test', hd: undefined }))
    expect(r).toMatchObject({ created: false, user: { id: ctx.users.viewerA.id } })
  })
  it('an admin signs in the same way', async () => {
    expect(await resolveUser(ctx.payload, cfg, verified({ email: 'admin@example.test', domain: 'example.test' }))).toMatchObject({ created: false })
  })
  it('website and sync accounts never sign in this way', async () => {
    for (const email of ['readera@example.test', 'synca@example.test']) {
      expect(await resolveUser(ctx.payload, cfg, verified({ email, domain: 'example.test' }))).toBe('role')
    }
  })
  it('a new person on the allowed domain gets an approver account with no sites, and sees nothing', async () => {
    const r = await resolveUser(ctx.payload, cfg, verified())
    expect(r).toMatchObject({ created: true, user: { role: 'editor' } })
    const user = (r as { user: { id: number } }).user
    const doc = (await ctx.payload.findByID({ collection: 'users', id: user.id, overrideAccess: true, depth: 0 })) as unknown as { tenants?: unknown[]; name: string }
    expect(doc.tenants ?? []).toEqual([])
    expect(doc.name).toBe('New Hire')
    for (const collection of ['posts', 'claims', 'pages'] as const) {
      // A viewer with no sites is refused outright or sees an empty list; either way, no content.
      const seen = await ctx.payload.find({ collection, overrideAccess: false, user: { ...(user as object), collection: 'users' } as never, depth: 0 }).catch(() => ({ docs: [] }))
      expect(seen.docs).toEqual([])
    }
  })
  it('the same person signing in again finds the account, and does not make a second', async () => {
    const r = await resolveUser(ctx.payload, cfg, verified())
    expect(r).toMatchObject({ created: false })
    expect((await ctx.payload.count({ collection: 'users', where: { email: { equals: 'newhire@neurocare.ai' } } })).totalDocs).toBe(1)
  })
  it('a new person is refused unless the domain is allowed and Google confirms the hosted domain', async () => {
    expect(await resolveUser(ctx.payload, cfg, verified({ email: 'x@other.com', domain: 'other.com', hd: 'other.com' }))).toBe('not-invited')
    expect(await resolveUser(ctx.payload, cfg, verified({ email: 'y@neurocare.ai', hd: undefined }))).toBe('not-invited') // a personal Google account on that address
    expect(await resolveUser(ctx.payload, cfg, verified({ email: 'z@neurocare.ai', hd: 'other.com' }))).toBe('not-invited')
    expect(await resolveUser(ctx.payload, cfg, verified({ email: 'w@neurocare.ai.evil.test', domain: 'neurocare.ai.evil.test', hd: 'neurocare.ai.evil.test' }))).toBe('not-invited')
    expect((await ctx.payload.count({ collection: 'users', where: { email: { in: ['x@other.com', 'y@neurocare.ai', 'z@neurocare.ai'] } } })).totalDocs).toBe(0)
  })
  it('an automatic account is never an admin, even for an admin-looking name', async () => {
    const r = await resolveUser(ctx.payload, cfg, verified({ email: 'admin@neurocare.ai', name: 'Admin' }))
    expect(r).toMatchObject({ created: true, user: { role: 'editor' } })
  })
})

describe('the session it starts', () => {
  const authWith = async (token: string) => (await ctx.payload.auth({ headers: new Headers({ cookie: `payload-token=${token}`, 'Sec-Fetch-Site': 'same-origin' }) })).user
  it('is a normal CMS session: it identifies the person, and a tampered token does not', async () => {
    const s = await startSession(ctx.payload, ctx.users.viewerA.id as number)
    expect(s.name).toBe('payload-token')
    expect(await authWith(s.token)).toMatchObject({ id: ctx.users.viewerA.id, role: 'editor' })
    expect(await authWith(`${s.token}x`)).toBeNull()
  })
  it('ends when its session is removed, as sign-out does', async () => {
    const s = await startSession(ctx.payload, ctx.users.viewerA.id as number)
    expect(await authWith(s.token)).not.toBeNull()
    await ctx.payload.db.updateOne({ collection: 'users', id: ctx.users.viewerA.id, data: { sessions: [] } as never, returning: false })
    expect(await authWith(s.token)).toBeNull()
  })
})

describe('the two routes, end to end (Google faked)', () => {
  const origin = 'http://localhost:3000'
  const setEnv = () => {
    process.env.AYRA_GOOGLE_CLIENT_ID = cfg.clientId
    process.env.AYRA_GOOGLE_CLIENT_SECRET = cfg.clientSecret
    process.env.AYRA_GOOGLE_ALLOWED_DOMAINS = 'neurocare.ai'
  }
  const clearEnv = () => {
    delete process.env.AYRA_GOOGLE_CLIENT_ID
    delete process.env.AYRA_GOOGLE_CLIENT_SECRET
    delete process.env.AYRA_GOOGLE_ALLOWED_DOMAINS
  }
  const cookieOf = (res: Response, name: string) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.split(';')[0]

  /** Signs in as the given Google identity through both routes. */
  async function signInAs(extra: Partial<GoogleClaims>, tamperState = false) {
    setEnv()
    const { GET: start } = await import('../src/app/(frontend)/auth/google/route')
    const { GET: callback } = await import('../src/app/(frontend)/auth/google/callback/route')
    const first = await start(new Request(`${origin}/auth/google?redirect=%2Fblogs%2F2`))
    expect(first.status).toBe(303)
    const to = new URL(first.headers.get('location')!)
    const hs = decodeURIComponent(cookieOf(first, 'cr-google')!.slice('cr-google='.length))
    const { nonce } = JSON.parse(hs) as { nonce: string }
    const real = globalThis.fetch
    globalThis.fetch = (async () => Response.json({ id_token: `x.${Buffer.from(JSON.stringify(claims({ nonce, ...extra }))).toString('base64url')}.y` })) as typeof fetch
    try {
      const state = tamperState ? 'wrong' : to.searchParams.get('state')!
      return await callback(new Request(`${origin}/auth/google/callback?code=abc&state=${state}`, { headers: { cookie: `cr-google=${encodeURIComponent(hs)}` } }))
    } finally {
      globalThis.fetch = real
      clearEnv()
    }
  }

  it('does nothing until both keys are set', async () => {
    clearEnv()
    const { GET: start } = await import('../src/app/(frontend)/auth/google/route')
    const res = await start(new Request(`${origin}/auth/google`))
    expect(res.headers.get('location')).toContain('/sign-in?error=google-not-configured')
  })
  it('an invited person lands signed in, on the page they asked for, with a cookie the CMS accepts', async () => {
    const res = await signInAs({ email: 'viewerA@example.test', hd: undefined })
    expect(res.status).toBe(200) // a page that moves on by itself, so the next request is same-origin
    expect(await res.text()).toContain('url=/blogs/2')
    const token = cookieOf(res, 'payload-token')!.slice('payload-token='.length)
    const { user } = await ctx.payload.auth({ headers: new Headers({ cookie: `payload-token=${token}`, 'Sec-Fetch-Site': 'same-origin' }) })
    expect(user).toMatchObject({ id: ctx.users.viewerA.id })
    expect(res.headers.getSetCookie().find((c) => c.startsWith('payload-token='))).toMatch(/HttpOnly/i)
  })
  it('a stranger is sent back to sign-in with no cookie and no account', async () => {
    const res = await signInAs({ email: 'stranger@other.com', hd: undefined })
    expect(res.headers.get('location')).toContain('/sign-in?error=google-not-invited')
    expect(cookieOf(res, 'payload-token')).toBeUndefined()
    expect((await ctx.payload.count({ collection: 'users', where: { email: { equals: 'stranger@other.com' } } })).totalDocs).toBe(0)
  })
  it('a wrong state (a forged return) is refused', async () => {
    const res = await signInAs({ email: 'viewerA@example.test' }, true)
    expect(res.headers.get('location')).toContain('/sign-in?error=google-failed')
    expect(cookieOf(res, 'payload-token')).toBeUndefined()
  })
})
