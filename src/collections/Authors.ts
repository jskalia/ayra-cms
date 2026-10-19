import type { CollectionConfig } from 'payload'

import { readContent, writeContent } from '../access/roles'

import { rebuildSitesAfterChange, rebuildSitesAfterDelete } from '../hooks/rebuildSites'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
  },
  hooks: {
    beforeChange: [bannedVocabularyBeforeChange],
    afterChange: [rebuildSitesAfterChange],
    afterDelete: [rebuildSitesAfterDelete],
  },

  access: {
    read: readContent({ drafts: false }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        description: 'Role or byline title, e.g. "Founder, AyraAgent".',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bio',
      type: 'textarea',
    },
  ],
}
