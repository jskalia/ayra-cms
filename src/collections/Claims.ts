import { ValidationError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { PUBLIC_ACTIVE, hasRole, readContent, writeContent } from '../access/roles'
import {
  internalRead,
  recordIdField,
  recordIndexes,
  recordStatusField,
  sha256Field,
  syncField,
  visibilityField,
} from '../fields/record'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Claims: every citable fact, mirrored from records/products/<product>/claims.json and shaped
 * like the promoted profile of templates/claims.schema.json (#/$defs/promotedClaim).
 * Websites see public, active claims only (G-SITE-7). The full record is checked against
 * claims.schema.json by the sync before it writes (Phase 4). Wording checks (K-number scope,
 * "never FDA approved", no unreleased module) are the claims lint's job, run before the sync.
 */
const promotedClaimRules: CollectionBeforeValidateHook = ({ data, originalDoc, collection }) => {
  const c = { ...originalDoc, ...data } as Record<string, unknown>
  const errors: { message: string; path: string }[] = []
  if (c.kNumber) {
    if (c.regulated !== true) errors.push({ path: 'regulated', message: 'A claim with a K-number is regulated.' })
    if (!c.platformVsModule) errors.push({ path: 'platformVsModule', message: 'A claim with a K-number needs platform vs module.' })
  }
  if ((c.status === 'deprecated' || c.status === 'retired') && !c.supersededBy && !c.note) {
    errors.push({ path: 'status', message: 'A deprecated or retired claim needs superseded_by or a note.' })
  }
  if (errors.length) throw new ValidationError({ collection: collection.slug, errors })
  return data
}

const datePattern = (value: unknown) =>
  value === undefined || value === null || value === '' || /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? true
    : 'Use yyyy-mm-dd.'

export const Claims: CollectionConfig = {
  slug: 'claims',
  lockDocuments: false,
  indexes: recordIndexes,
  admin: { useAsTitle: 'recordId', defaultColumns: ['recordId', 'visibility', 'status', 'regulated'] },
  hooks: { beforeValidate: [sameTenantReferences(), promotedClaimRules], beforeChange: [bannedVocabularyBeforeChange] },
  access: {
    read: readContent({ publicOnly: PUBLIC_ACTIVE }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
    // No versions today; if they are ever enabled, website keys must not read them.
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  fields: [
    recordIdField('claim:'),
    { name: 'entity', type: 'text', admin: { description: 'The claims.json file’s entity.' } },
    { name: 'text', type: 'textarea', required: true },
    {
      name: 'source',
      type: 'group',
      access: internalRead,
      fields: [
        { name: 'path', type: 'text', required: true },
        { name: 'lineOrSection', type: 'text', required: true },
        { name: 'pinnedDate', type: 'text', required: true, validate: datePattern },
        { name: 'commit', type: 'text' },
      ],
    },
    sha256Field('sha256', true),
    { name: 'quote', type: 'textarea', required: true },
    visibilityField,
    { name: 'visibilityNote', type: 'text', access: internalRead },
    recordStatusField,
    { name: 'regulated', type: 'checkbox', required: true, defaultValue: false },
    {
      name: 'kNumber',
      type: 'text',
      validate: (v: unknown) => (!v || /^K[0-9]{6}$/.test(String(v)) ? true : 'A K-number is K followed by 6 digits.'),
    },
    {
      name: 'platformVsModule',
      type: 'select',
      options: [
        { label: 'Platform', value: 'platform' },
        { label: 'Module', value: 'module' },
        { label: 'n/a', value: 'n/a' },
      ],
    },
    {
      name: 'product',
      type: 'text',
      validate: (v: unknown) =>
        !v || /^product:[a-z0-9]+(-[a-z0-9]+)*$/.test(String(v)) ? true : 'Use product:<id>.',
    },
    {
      name: 'fdaView',
      type: 'group',
      admin: { description: 'Signed by a person; never "FDA approved" (S-13).' },
      fields: [
        { name: 'signedBy', type: 'text' },
        { name: 'signedAt', type: 'text' },
      ],
    },
    { name: 'approvedBy', type: 'text', required: true, access: internalRead },
    { name: 'approvedAt', type: 'text', required: true, validate: datePattern, access: internalRead },
    { name: 'supersededBy', type: 'text' },
    { name: 'note', type: 'textarea', access: internalRead },
    syncField,
  ],
}
