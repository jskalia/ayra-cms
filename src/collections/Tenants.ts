import type { CollectionConfig } from 'payload'

import { hasRole, isSignedIn } from '../access/roles'
import { internalRead } from '../fields/record'

/**
 * One tenant per website (WebsiteOps plan MP-D39; decision D1). A site reads only its own
 * tenant, with its own API key. Tenants are created by a migration or by an admin.
 */
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  lockDocuments: false,
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
    {
      // Where this site's blog posts are written: an AyraAgent organization's Blogs (its
      // published blogs become this site's posts; see src/sync/blogs.ts). Never shown to websites.
      name: 'ayraBlogs',
      type: 'group',
      access: internalRead,
      admin: { description: 'Published blogs from this AyraAgent organization become this site’s posts.' },
      fields: [
        { name: 'org', type: 'text', admin: { description: 'AyraAgent organization id, e.g. ayra (Save Life). Empty: no import.' } },
        {
          name: 'tokenEnv',
          type: 'text',
          admin: { description: 'Name (not value) of the env var holding the read-only AyraAgent service token for this org.' },
        },
        {
          name: 'author',
          type: 'group',
          admin: { description: 'The real person shown as the author (BlogPosting JSON-LD).' },
          fields: [
            { name: 'name', type: 'text' },
            { name: 'jobTitle', type: 'text' },
            { name: 'url', type: 'text' },
          ],
        },
      ],
    },
  ],
}
