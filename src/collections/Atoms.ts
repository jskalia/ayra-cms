import type { CollectionConfig } from 'payload'

import { PUBLIC_ACTIVE, readContent, writeContent } from '../access/roles'
import { jsonField, recordIdField, recordIndexes, recordStatusField, syncField, visibilityField } from '../fields/record'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Atoms: the data behind diagrams and cards (workflow, platform map, table, faq, metric, quote),
 * mirrored from records/products/<product>/atoms.json (templates/atoms.schema.json).
 * The kind-specific parts (nodes ≤ 9, edges, steps, layers, before/after, table rows, faq items,
 * metric value/unit, quote) are kept together in `shape`, exactly as in the record.
 * Websites see public, active atoms only (G-SITE-7).
 */
export const Atoms: CollectionConfig = {
  slug: 'atoms',
  lockDocuments: false,
  indexes: recordIndexes,
  admin: { useAsTitle: 'recordId', defaultColumns: ['recordId', 'kind', 'visibility', 'status'] },
  hooks: { beforeValidate: [sameTenantReferences()] },
  access: {
    read: readContent({ publicOnly: PUBLIC_ACTIVE }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
  },
  fields: [
    recordIdField('atom:'),
    { name: 'version', type: 'number', min: 1 },
    {
      name: 'kind',
      type: 'select',
      options: ['diagram', 'card', 'platform_map', 'workflow', 'table', 'faq', 'metric', 'quote'].map((v) => ({
        label: v,
        value: v,
      })),
    },
    {
      name: 'recipe',
      type: 'select',
      options: Array.from({ length: 10 }, (_, i) => ({ label: `R${i + 1}`, value: `R${i + 1}` })),
    },
    { name: 'title', type: 'text' },
    {
      name: 'claims',
      type: 'text',
      hasMany: true,
      admin: { description: 'claim:<id> references this atom rests on.' },
    },
    { name: 'assets', type: 'text', hasMany: true, admin: { description: 'asset:<org>/<kind>/<id>@<v> references.' } },
    visibilityField,
    { name: 'visibilityNote', type: 'text' },
    recordStatusField,
    jsonField('shape', 'Kind-specific fields from atoms.json (nodes, edges, steps, rows, items, …).'),
    syncField,
  ],
}
