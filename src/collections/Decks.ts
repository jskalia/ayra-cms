import type { CollectionConfig } from 'payload'

import { hasRole, readContent, writeContent } from '../access/roles'
import { recordIdField, recordIndexes, syncField } from '../fields/record'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'
import { publicReferences } from '../hooks/pageReferences'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Decks: House web decks (web-deck-publish.md), shown by the deck-embed block at /decks/<id>;
 * investor decks are the same records with gate: investor, shown at /investorportal/<id>.
 * Web slides only, never a PDF or PPTX (MP-D31). The deck itself is built by deckkit in _ops;
 * the CMS holds its record: id, title, where the built deck lives, cover asset, gate, status.
 * Websites see approved, ungated decks only; gated ones reach a site through a gated key later.
 */
const deckReferences = publicReferences({
  collect: (d) => [d.coverAsset],
  approved: (d) => d.status === 'approved',
  isPublic: (d) => !d.gate || d.gate === 'none',
})

export const Decks: CollectionConfig = {
  slug: 'decks',
  lockDocuments: false,
  indexes: recordIndexes,
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'recordId', 'gate', 'status'] },
  hooks: { beforeValidate: [sameTenantReferences(), deckReferences], beforeChange: [bannedVocabularyBeforeChange] },
  access: {
    read: readContent({ publicOnly: { and: [{ status: { equals: 'approved' } }, { gate: { equals: 'none' } }] } }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  fields: [
    recordIdField('deck:'),
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    { name: 'source', type: 'text', admin: { description: 'Where the built web deck lives (path or URL), from deckkit.' } },
    { name: 'coverAsset', type: 'text', admin: { description: 'asset:<org>/<kind>/<id>@<v> (share preview).' } },
    {
      name: 'gate',
      type: 'select',
      required: true,
      defaultValue: 'none',
      options: [
        { label: 'None (public deck)', value: 'none' },
        { label: 'Investor portal', value: 'investor' },
        { label: 'Partner', value: 'partner' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'approved', 'retired'].map((v) => ({ label: v, value: v })),
    },
    syncField,
  ],
}
