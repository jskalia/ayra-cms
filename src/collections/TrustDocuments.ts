import type { CollectionConfig } from 'payload'

import { hasRole } from '../access/roles'
import { recordIdField, recordIndexes, sha256Field, syncField } from '../fields/record'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Trust Center documents (web-trust-center.md): a gated mirror, never the source of record.
 * Fields: title, type, version, effective date, owner, source hash; versions are write-once.
 * Behind email verification on the site, so NO website key reads them here (a gated key comes
 * with the Trust Center). The files themselves wait for private storage (review finding F8):
 * this collection holds the records only.
 */
export const TrustDocuments: CollectionConfig = {
  slug: 'trust-documents',
  lockDocuments: false,
  indexes: recordIndexes,
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'type', 'version', 'status'] },
  hooks: { beforeValidate: [sameTenantReferences()], beforeChange: [bannedVocabularyBeforeChange] },
  access: {
    read: hasRole('admin', 'editor', 'sync'),
    create: hasRole('sync'),
    update: hasRole('sync'),
    delete: () => false, // write-once versions: no overwrite, no delete
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  fields: [
    recordIdField('trustdoc:'),
    { name: 'title', type: 'text', required: true },
    { name: 'type', type: 'text', admin: { description: 'e.g. soc2-report, pen-test-summary, policy' } },
    { name: 'version', type: 'text' },
    { name: 'effectiveAt', type: 'text', admin: { description: 'yyyy-mm-dd' } },
    { name: 'owner', type: 'text', admin: { description: 'Position that owns the document.' } },
    sha256Field('sourceSha256'),
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'approved', 'superseded', 'retired'].map((v) => ({ label: v, value: v })),
    },
    syncField,
  ],
}
