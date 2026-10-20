import type { Payload, TypedUser } from 'payload'

/** A signed-in person (admin or viewer) and the read options that keep every query inside their permissions. */
export type Session = {
  payload: Payload
  user: TypedUser & { id: number | string; name?: string; email?: string; role?: string }
  isAdmin: boolean
}

export const as = (s: Session) => ({ overrideAccess: false as const, user: s.user })
