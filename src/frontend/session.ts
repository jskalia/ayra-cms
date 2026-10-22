import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '../../payload.config'
import type { Session } from './access'

export { as, type Session } from './access'

/**
 * The control room's session: the person signed in to the CMS (same sign-in as /admin).
 * Every read below passes this user with overrideAccess: false, so a viewer only ever sees
 * the sites assigned to them, and nobody can change content from here (S-1).
 */

export async function requireSession(path: string): Promise<Session> {
  // Read the request first: it marks the page as per-request before anything touches the
  // database, so a build with no database (CI) never tries to prerender it.
  const requestHeaders = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: requestHeaders })
  const role = (user as { role?: string } | null)?.role
  // Website and sync accounts never sign in with a password, but check anyway.
  if (!user || (role !== 'admin' && role !== 'editor')) {
    redirect(`/sign-in?redirect=${encodeURIComponent(path)}`)
  }
  return { payload, user: user as Session['user'], isAdmin: role === 'admin' }
}
