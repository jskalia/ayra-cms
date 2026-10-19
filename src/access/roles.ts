import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

/**
 * Who may do what (WebsiteOps plan: one tenant per site; content enters only by the
 * one-way sync from _ops; the admin is read-only for content).
 *
 *  admin       a person who manages users and tenants; sees every tenant; cannot edit content
 *  editor      a person with read-only access to the tenants assigned to them
 *  site-reader a website's API key; reads published content of its own tenant only
 *  sync        the _ops sync; the only role that writes content, in its own tenants only
 *
 * Tenant scoping itself is applied by @payloadcms/plugin-multi-tenant for every signed-in
 * user except admins. Anonymous requests are not scoped by the plugin, so every content
 * collection must refuse them (isSignedIn below).
 */
export const ROLES = ['admin', 'editor', 'site-reader', 'sync'] as const
export type Role = (typeof ROLES)[number]

type MaybeUser = PayloadRequest['user'] & { role?: Role | null }

export const roleOf = (req: PayloadRequest): Role | undefined =>
  ((req.user as MaybeUser) ?? undefined)?.role ?? undefined

export const hasRole =
  (...roles: Role[]): Access =>
  ({ req }) => {
    const role = roleOf(req)
    return Boolean(role && roles.includes(role))
  }

/** The same check for field-level access (e.g. who may set a role or assign tenants). */
export const fieldHasRole =
  (...roles: Role[]): FieldAccess =>
  ({ req }) => {
    const role = roleOf(req)
    return Boolean(role && roles.includes(role))
  }

export const isSignedIn: Access = ({ req }) => Boolean(req.user)

/**
 * Content: signed-in only. A website key (site-reader) additionally sees only what may be
 * public: published documents (drafts) and whatever `publicOnly` demands, e.g. visibility
 * public and status active (the visibility firewall, G-SITE-7) or released products (MP-D29).
 */
export const readContent =
  ({ drafts = false, publicOnly }: { drafts?: boolean; publicOnly?: Where } = {}): Access =>
  ({ req }) => {
    const role = roleOf(req)
    if (!req.user || !role || !ROLES.includes(role)) return false
    if (role !== 'site-reader') return true
    const rules: Where[] = []
    if (drafts) rules.push({ _status: { equals: 'published' } })
    if (publicOnly) rules.push(publicOnly)
    return rules.length ? { and: rules } : true
  }

/** The visibility firewall for records that carry visibility and status. */
export const PUBLIC_ACTIVE: Where = {
  and: [{ visibility: { equals: 'public' } }, { status: { equals: 'active' } }],
}

/** Content writes come only from the sync account. */
export const writeContent: Access = hasRole('sync')

/** Only people (admin, editor) may open the admin screen; API accounts may not. */
export const canUseAdmin = ({ req }: { req: PayloadRequest }): boolean => {
  const role = roleOf(req)
  return role === 'admin' || role === 'editor'
}
