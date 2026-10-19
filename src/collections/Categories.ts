import type { CollectionConfig } from 'payload'

import { readContent, writeContent } from '../access/roles'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

import { rebuildSitesAfterChange, rebuildSitesAfterDelete } from '../hooks/rebuildSites'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'

export const Categories: CollectionConfig = {
  slug: 'categories',
  lockDocuments: false,
  admin: {
    useAsTitle: 'title',
  },
  hooks: {
    beforeValidate: [sameTenantReferences()],
    beforeChange: [bannedVocabularyBeforeChange],
    afterChange: [rebuildSitesAfterChange],
    afterDelete: [rebuildSitesAfterDelete],
  },

  // A slug is unique within a site (tenant), not across all sites.
  indexes: [{ fields: ['tenant', 'slug'], unique: true }],
  access: {
    read: readContent({ drafts: false }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
  },
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
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
}
