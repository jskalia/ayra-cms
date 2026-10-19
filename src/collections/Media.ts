import type { CollectionConfig } from 'payload'

import { hasRole, readContent, writeContent } from '../access/roles'
import { recordIdField, recordIndexes, sha256Field, syncField } from '../fields/record'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'
import { sameTenantReferences } from '../hooks/sameTenantReferences'


/**
 * Assets: approved images, each with its asset id (metadesign/frames.md: asset:<org>/<kind>/<id>@<v>),
 * hash, licence and attribution (web-product-images). Files live in the PUBLIC Blob store, so
 * only public, website-safe assets belong here: investor-only or internal files must never be
 * uploaded (review finding F8); gated documents get private storage in their own collections.
 * Websites see approved assets only.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  lockDocuments: false,
  indexes: recordIndexes,
  admin: { useAsTitle: 'recordId', defaultColumns: ['recordId', 'kind', 'status'] },
  upload: {
    mimeTypes: ['image/*'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 768, height: 576, position: 'centre' },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
  },
  hooks: {
    beforeChange: [bannedVocabularyBeforeChange],
    beforeValidate: [sameTenantReferences()],
  },

  access: {
    read: readContent({ publicOnly: { status: { equals: 'approved' } } }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
    // No versions today; if they are ever enabled, website keys must not read them.
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  fields: [
    recordIdField('asset:'),
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['og', 'square', 'portrait', 'story', 'email', 'slide-16x9', 'section', 'screen', 'diagram', 'logo', 'photo', 'video'].map(
        (v) => ({ label: v, value: v }),
      ),
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Approved', value: 'approved' },
        { label: 'Retired', value: 'retired' },
      ],
      admin: { description: 'Approved in DesignOps; only approved assets reach a website.' },
    },
    sha256Field('sha256'),
    { name: 'licence', type: 'text', admin: { description: 'Licence of the image (web-product-images).' } },
    { name: 'attribution', type: 'text' },
    { name: 'consent', type: 'text', admin: { description: 'Consent record for any person shown.' } },
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Describe the image for screen readers and SEO.',
      },
    },
    syncField,
  ],
}
