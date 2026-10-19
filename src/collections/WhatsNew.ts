import type { CollectionConfig, Field } from 'payload'

import { fieldHasRole, hasRole, readContent, writeContent } from '../access/roles'
import { jsonField, recordIdField, recordIndexes, syncField, visibilityField } from '../fields/record'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'
import { publicReferences } from '../hooks/pageReferences'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * What's New: one release record (templates/release-record.md), from
 * records/releases/<yyyy>-<slug>/release.md. The entry page, RSS item and OG card are made from it.
 * The announce bar reads "latest approved".
 *
 * Websites see approved or published, public entries only. Each entry cites claims for what
 * shipped and for its regulated lines; those must be public. The internal parts are hidden from
 * website keys: the feature list (beta and internal features never reach customers, P-3,
 * MP-D29), the source, withheld facts, channel drafts, approvals, receipts and site-release data.
 */
const internalOnly = { read: fieldHasRole('admin', 'editor', 'sync') }

const by = (name: string, extra: Field[] = []): Field => ({
  name,
  type: 'group',
  fields: [{ name: 'by', type: 'text' }, { name: 'at', type: 'text' }, ...extra],
})

export const WhatsNew: CollectionConfig = {
  slug: 'whats-new',
  lockDocuments: false,
  indexes: recordIndexes,
  defaultSort: '-releasedAt',
  admin: { useAsTitle: 'recordId', defaultColumns: ['recordId', 'product', 'releasedAt', 'status'] },
  hooks: {
    beforeValidate: [
      sameTenantReferences(),
      publicReferences({
        collect: (r) => [r.product, r.whatShipped, r.regulated, r.assets],
        approved: (r) => r.status === 'approved' || r.status === 'published',
        isPublic: (r) => r.visibility === 'public',
      }),
    ],
    beforeChange: [bannedVocabularyBeforeChange],
  },
  access: {
    read: readContent({
      publicOnly: {
        and: [{ status: { in: ['approved', 'published'] } }, { visibility: { equals: 'public' } }],
      },
    }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
    // No versions today; if they are ever enabled, website keys must not read them.
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  fields: [
    recordIdField('release:'),
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'product-release',
      options: [
        { label: 'Product release', value: 'product-release' },
        { label: 'Site release', value: 'site-release' },
      ],
    },
    {
      name: 'product',
      type: 'text',
      validate: (v: unknown) => (!v || /^product:[a-z0-9]+(-[a-z0-9]+)*$/.test(String(v)) ? true : 'Use product:<id>.'),
    },
    { name: 'version', type: 'text' },
    { name: 'releasedAt', type: 'date', index: true },
    { name: 'title', type: 'text', admin: { description: 'Entry title (from the entry page).' } },
    { name: 'summary', type: 'textarea', admin: { description: '≤ 60 words of connective copy; facts are in what shipped.' } },
    {
      name: 'tier',
      type: 'select',
      options: ['T1', 'T2', 'T3'].map((v) => ({ label: v, value: v })),
      admin: { description: 'Set by the product owner.' },
    },
    { name: 'audiences', type: 'text', hasMany: true, admin: { description: 'audience:<id>' } },
    { name: 'whatShipped', type: 'text', hasMany: true, admin: { description: 'Each line is a cited claim:<id>.' } },
    {
      name: 'regulated',
      type: 'array',
      admin: { description: 'One row per regulated claim; never "FDA approved" (S-13).' },
      fields: [
        { name: 'claim', type: 'text', required: true },
        { name: 'kNumber', type: 'text' },
        {
          name: 'platformVsModule',
          type: 'select',
          options: ['platform', 'module'].map((v) => ({ label: v, value: v })),
        },
        { name: 'fdaSignedBy', type: 'text' },
        { name: 'fdaSignedAt', type: 'text' },
      ],
    },
    visibilityField,
    { name: 'canonicalUrl', type: 'text' },
    { name: 'entry', type: 'text', admin: { description: 'The entry page record (template whats-new-entry).' } },
    { name: 'assets', type: 'text', hasMany: true, admin: { description: 'asset:<org>/<kind>/<id>@<v> (OG card, screens).' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'approved', 'published', 'withdrawn'].map((v) => ({ label: v, value: v })),
    },
    // Internal: never readable by a website key.
    {
      name: 'features',
      type: 'array',
      access: internalOnly,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'state', type: 'select', required: true, options: ['ga', 'beta', 'internal'].map((v) => ({ label: v, value: v })) },
        { name: 'claim', type: 'text' },
      ],
    },
    {
      name: 'source',
      type: 'group',
      access: internalOnly,
      fields: [
        {
          name: 'type',
          type: 'select',
          options: ['manual', 'sdd-status', 'pr-merged', 'release-note', 'tag', 'webhook'].map((v) => ({ label: v, value: v })),
        },
        { name: 'ref', type: 'text' },
        { name: 'sha256', type: 'text' },
      ],
    },
    jsonField('withheld', 'Facts deliberately left out, with the reason.', { array: true, access: internalOnly }),
    jsonField('channels', 'Channel drafts (social, newsletter); a person posts or sends each.', { array: true, access: internalOnly }),
    {
      name: 'approvals',
      type: 'group',
      access: internalOnly,
      fields: [by('facts'), by('entry', [{ name: 'version', type: 'text' }]), by('production')],
    },
    jsonField('receipts', 'sync, indexnow, feed and og receipts.', { access: internalOnly }),
    jsonField('siteRelease', 'Site-release data (preview url, deployment id, build sha).', { access: internalOnly }),
    syncField,
  ],
}
