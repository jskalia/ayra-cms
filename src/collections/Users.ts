import type { CollectionConfig } from 'payload'

import { canUseAdmin, fieldHasRole, hasRole, roleOf } from '../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
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
    update: ({ req }) => (roleOf(req) === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false),
    delete: hasRole('admin'),
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
