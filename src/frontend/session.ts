import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload, type TypedUser } from 'payload'

import config from '../../payload.config'

/**
 * The control room's session: the person signed in to the CMS (same sign-in as /admin).
 * Every read below passes this user with overrideAccess: false, so a viewer only ever sees
 * the sites assigned to them, and nobody can change content from here (S-1).
 */
export type Session = {
  payload: Payload
  user: TypedUser & { id: number | string; name?: string; email?: string; role?: string }
  isAdmin: boolean
}

export async function requireSession(path: string): Promise<Session> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const role = (user as { role?: string } | null)?.role
  // Website and sync accounts never sign in with a password, but check anyway.
  if (!user || (role !== 'admin' && role !== 'editor')) {
    redirect(`/admin/login?redirect=${encodeURIComponent(path)}`)
  }
  return { payload, user: user as Session['user'], isAdmin: role === 'admin' }
}

/** Read options that keep every query inside the signed-in person's permissions. */
export const as = (s: Session) => ({ overrideAccess: false as const, user: s.user })
