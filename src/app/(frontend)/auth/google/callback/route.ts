import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '../../../../../../payload.config'
import { safeRedirect } from '../../../../../frontend/safe-redirect'
import { checkClaims, exchangeCode, googleConfig, resolveUser, startSession, type Handshake } from '../../../../../lib/google-sso'

const HANDSHAKE_COOKIE = 'cr-google'

/** Google sends the browser back here with a code. Check it, find or create the person, and start their session. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/sign-in?error=google-${code}`, url), 303)
    res.cookies.set(HANDSHAKE_COOKIE, '', { path: '/auth/google', maxAge: 0 })
    return res
  }
  const cfg = googleConfig()
  if (!cfg) return fail('not-configured')
  if (url.searchParams.get('error')) return fail('denied') // they closed or declined Google's screen

  let handshake: Handshake | undefined
  try {
    const raw = request.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith(`${HANDSHAKE_COOKIE}=`))
    handshake = raw ? (JSON.parse(decodeURIComponent(raw.slice(HANDSHAKE_COOKIE.length + 1))) as Handshake) : undefined
  } catch {
    handshake = undefined
  }
  const code = url.searchParams.get('code')
  if (!handshake || !code || url.searchParams.get('state') !== handshake.state) return fail('failed')

  const payload = await getPayload({ config })
  if (!payload.config.csrf.includes(url.origin)) return fail('origin')

  try {
    const claims = await exchangeCode(cfg, { code, redirectUri: `${url.origin}/auth/google/callback`, verifier: handshake.verifier })
    const who = checkClaims(cfg, claims, handshake.nonce)
    if (typeof who === 'string') return fail(who)
    const resolved = await resolveUser(payload, cfg, who)
    if (typeof resolved === 'string') return fail(resolved)

    const session = await startSession(payload, resolved.user.id)
    payload.logger.info(`Google sign-in: ${resolved.created ? 'new account created' : 'existing account'} (user ${resolved.user.id})`)
    // Not a redirect: the browser arrived from Google (cross-site), and a redirect chain that starts
    // cross-site stays cross-site, so the CMS would not accept the new cookie on the next page.
    // A page of our own that moves on by itself makes that next request same-origin.
    const to = safeRedirect(handshake.next)
    const res = new NextResponse(
      `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${to.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"><title>Signing in</title><p>Signing you in… <a href="${to.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Continue</a></p>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
    )
    res.cookies.set(session.name, session.token, { httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', path: '/', expires: session.expires })
    res.cookies.set(HANDSHAKE_COOKIE, '', { path: '/auth/google', maxAge: 0 })
    return res
  } catch (err) {
    payload.logger.error({ err, msg: 'Google sign-in failed' })
    return fail('failed')
  }
}
