import type { CollectionConfig } from 'payload'

import { readContent, writeContent } from '../access/roles'
import { jsonField, recordIdField, recordIndexes, syncField } from '../fields/record'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Products, mirrored from _ops/_<org>_ops/marketing/records/products/<product>/product.md.
 * Websites see released products only: an unreleased module is never public (MP-D29), and the
 * product hub and nav read this flag, never a list in code (page-templates.md).
 */
export const Products: CollectionConfig = {
  slug: 'products',
  lockDocuments: false,
  indexes: recordIndexes,
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'recordId', 'released'] },
  hooks: { beforeValidate: [sameTenantReferences()] },
  access: {
    read: readContent({ publicOnly: { released: { equals: true } } }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
  },
  fields: [
    recordIdField('product:'),
    { name: 'name', type: 'text', required: true },
    {
      name: 'released',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      admin: { description: 'Only released products reach a website.' },
    },
    { name: 'status', type: 'text', admin: { description: 'The status field of product.md, as written there.' } },
    jsonField('record', 'The rest of product.md front matter, as synced.'),
    syncField,
  ],
}
