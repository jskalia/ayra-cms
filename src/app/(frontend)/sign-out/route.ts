import { NextResponse } from 'next/server'
import { createLocalReq, getPayload, logoutOperation } from 'payload'

import config from '../../../../payload.config'

/**
 * Sign out of the control room (and the admin): end the session on the server, so the token
 * stops working everywhere, then clear the cookie. POST only, from the sidebar's form.
 */
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (user) {
    const req = await createLocalReq({ user }, payload)
    await logoutOperation({ collection: payload.collections.users, req }).catch(() => undefined)
  }
  const res = NextResponse.redirect(new URL('/admin/login', request.url), 303)
  res.cookies.set(`${payload.config.cookiePrefix}-token`, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' })
  return res
}
