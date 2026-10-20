import type { CollectionConfig } from 'payload'

import { PUBLIC_ACTIVE, hasRole, readContent, writeContent } from '../access/roles'
import { jsonField, recordIdField, recordIndexes, recordStatusField, syncField, visibilityField } from '../fields/record'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Audiences and workflows behind the solution paths (/solutions/<audience>, page-templates.md;
 * nav "Solutions by audience/workflow", MP-D20). Sir's plan names them but does not fix their
 * fields yet (they come from R3 architecture), so each holds its id, name, summary,
 * visibility and status, with the rest of the record kept as synced.
 * Websites see public, active ones only.
 */
const make = (slug: 'audiences' | 'workflows', prefix: 'audience:' | 'workflow:'): CollectionConfig => ({
  slug,
  lockDocuments: false,
  indexes: recordIndexes,
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'recordId', 'visibility', 'status'] },
  hooks: { beforeValidate: [sameTenantReferences()], beforeChange: [bannedVocabularyBeforeChange] },
  access: {
    read: readContent({ publicOnly: PUBLIC_ACTIVE }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  fields: [
    recordIdField(prefix),
    { name: 'name', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    visibilityField,
    recordStatusField,
    jsonField('record', 'The rest of the record, as synced.'),
    syncField,
  ],
})

export const Audiences = make('audiences', 'audience:')
export const Workflows = make('workflows', 'workflow:')
