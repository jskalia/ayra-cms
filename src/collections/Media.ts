import type { CollectionConfig } from 'payload'

import { rebuildSitesAfterChange, rebuildSitesAfterDelete } from '../hooks/rebuildSites'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    mimeTypes: ['image/*'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 768, height: 576, position: 'centre' },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
  },
  hooks: {
    afterChange: [rebuildSitesAfterChange],
    afterDelete: [rebuildSitesAfterDelete],
  },

  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Describe the image for screen readers and SEO.',
      },
    },
  ],
}
