import type { CollectionConfig } from 'payload'

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
    read: () => true,
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
