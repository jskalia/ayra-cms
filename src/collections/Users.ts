import { APIError, type CollectionConfig } from 'payload'

import { canUseAdmin, fieldHasRole, hasRole, roleOf } from '../access/roles'
import { resetsNeedEmail } from '../lib/email'

export const Users: CollectionConfig = {
  slug: 'users',
  lockDocuments: false,
  // API keys are for the website (site-reader) and sync accounts; people sign in with a password.
  auth: { useAPIKey: true },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role'],
  },
  access: {
    admin: canUseAdmin,
    // Admins see every account; everyone else sees only their own.
    read: ({ req }) => (roleOf(req) === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false),
    create: hasRole('admin'),
    // Admins edit any account; a viewer may edit only their own (name, email, password).
    // Website and sync accounts cannot change themselves.
    update: ({ req }) => {
      const role = roleOf(req)
      if (role === 'admin') return true
      if (role === 'editor' && req.user) return { id: { equals: req.user.id } }
      return false
    },
    delete: hasRole('admin'),
  },
  hooks: {
    // No email, no reset link: it would only end up in the server log (src/lib/email.ts).
    beforeOperation: [resetsNeedEmail],
    // Website and sync accounts work only with their API key, never with a password.
    beforeLogin: [
      ({ user }) => {
        if (user?.role === 'site-reader' || user?.role === 'sync') {
          throw new APIError('This account signs in with an API key only.', 403, undefined, true)
        }
      },
    ],
    // Only an admin turns API keys on or changes them.
    beforeChange: [
      ({ data, originalDoc, req }) => {
        const touchesKey =
          data.enableAPIKey !== undefined && Boolean(data.enableAPIKey) !== Boolean(originalDoc?.enableAPIKey)
        if ((touchesKey || data.apiKey || data.apiKeyIndex) && roleOf(req) !== 'admin' && req.user) {
          throw new APIError('Only an admin can manage API keys.', 403, undefined, true)
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      // Only an admin can give or change a role (so nobody can promote themselves).
      access: { create: fieldHasRole('admin'), update: fieldHasRole('admin') },
      options: [
        { label: 'Admin (manages users and tenants; cannot edit content)', value: 'admin' },
        { label: 'Viewer (read-only, assigned tenants)', value: 'editor' },
        { label: 'Website reader (API key, one tenant, published only)', value: 'site-reader' },
        { label: 'Sync (API key; the only writer of content)', value: 'sync' },
      ],
    },
  ],
}
