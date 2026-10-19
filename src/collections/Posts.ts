import type { CollectionConfig } from 'payload'

import { hasRole, readContent, writeContent } from '../access/roles'
import { refs, richTextRefs, sameTenantReferences } from '../hooks/sameTenantReferences'

import { rebuildSitesAfterChange, rebuildSitesAfterDelete } from '../hooks/rebuildSites'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'

export const Posts: CollectionConfig = {
  slug: 'posts',
  lockDocuments: false,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'publishedAt', 'categories'],
  },
  hooks: {
    beforeValidate: [
      sameTenantReferences((d) => [
        ...refs('media', d.featuredImage),
        ...refs('categories', d.categories),
        ...refs('authors', d.authors),
        ...richTextRefs(d.content),
      ]),
    ],
    beforeChange: [bannedVocabularyBeforeChange],
    afterChange: [rebuildSitesAfterChange],
    afterDelete: [rebuildSitesAfterDelete],
  },

  // A slug is unique within a site (tenant), not across all sites.
  indexes: [{ fields: ['tenant', 'slug'], unique: true }],
  access: {
    read: readContent({ drafts: true }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
    // Drafts and old versions are never visible to a website key.
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              index: true,
              admin: {
                position: 'sidebar',
                description: 'URL segment, e.g. /blog/why-agents-need-context',
              },
            },
            {
              name: 'excerpt',
              type: 'textarea',
              admin: {
                description: 'Short summary used in listings and meta descriptions.',
              },
            },
            {
              name: 'content',
              type: 'richText',
              required: true,
            },
          ],
        },
        {
          label: 'Meta',
          fields: [
            {
              name: 'categories',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
            },
            {
              name: 'authors',
              type: 'relationship',
              relationTo: 'authors',
              hasMany: true,
            },
            {
              name: 'featuredImage',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'publishedAt',
              type: 'date',
              admin: {
                position: 'sidebar',
                date: {
                  pickerAppearance: 'dayAndTime',
                },
              },
            },
            {
              name: 'metaDescription',
              type: 'textarea',
              admin: {
                description: 'Overrides excerpt for SEO when set.',
              },
            },
          ],
        },
      ],
    },
  ],
}
