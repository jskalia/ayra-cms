import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '../../../../../payload.config'
import { safeRedirect } from '../../../../frontend/safe-redirect'
import { authUrl, googleConfig, newHandshake } from '../../../../lib/google-sso'

const HANDSHAKE_COOKIE = 'cr-google'

const toSignIn = (request: Request, error: string) => NextResponse.redirect(new URL(`/sign-in?error=${error}`, request.url), 303)

/** Start Sign in with Google: remember this attempt (state, PKCE, nonce) in a short-lived cookie, then go to Google. */
export async function GET(request: Request) {
  const cfg = googleConfig()
  if (!cfg) return toSignIn(request, 'google-not-configured')
  const url = new URL(request.url)
  // Only the CMS's own origins may be used as the return address (Google also checks the registered list).
  const payload = await getPayload({ config })
  if (!payload.config.csrf.includes(url.origin)) return toSignIn(request, 'google-origin')

  const handshake = newHandshake(safeRedirect(url.searchParams.get('redirect')))
  const res = NextResponse.redirect(authUrl(cfg, `${url.origin}/auth/google/callback`, handshake), 303)
  res.cookies.set(HANDSHAKE_COOKIE, JSON.stringify(handshake), {
    httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', path: '/auth/google', maxAge: 600,
  })
  return res
}
