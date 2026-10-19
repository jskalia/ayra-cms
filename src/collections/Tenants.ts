import type { CollectionConfig } from 'payload'

import { hasRole, isSignedIn } from '../access/roles'

/**
 * One tenant per website (WebsiteOps plan MP-D39; decision D1). A site reads only its own
 * tenant, with its own API key. Tenants are created by a migration or by an admin.
 */
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status'],
  },
  access: {
    // The multi-tenant plugin narrows this to the user's own tenants (admins see all).
    read: isSignedIn,
    create: hasRole('admin'),
    update: hasRole('admin'),
    delete: () => false,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Stable id used by site.yaml (cms.tenant) and the sync, e.g. savelifeai.' },
    },
    {
      name: 'domains',
      type: 'array',
      fields: [{ name: 'domain', type: 'text', required: true }],
      admin: { description: 'Domains this site serves, e.g. savelife.ai.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'planned',
      options: [
        { label: 'Planned', value: 'planned' },
        { label: 'Active', value: 'active' },
        { label: 'Retired', value: 'retired' },
      ],
    },
    {
      name: 'deployHookEnv',
      type: 'text',
      admin: {
        description:
          'Name (not value) of the env var holding this site’s Vercel deploy hook, used to start a preview after a sync.',
      },
    },
  ],
}
