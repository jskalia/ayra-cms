import { ValidationError, type CollectionBeforeValidateHook, type CollectionConfig, type Where } from 'payload'

import { hasRole, readContent, writeContent } from '../access/roles'
import { recordIdField, recordIndexes, syncField } from '../fields/record'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'
import { markdownBody } from '../hooks/markdownBody'
import { publicReferences } from '../hooks/pageReferences'
import { richTextRefs, sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Legal pages, versioned (legal_pages_plan.md §5 LegalDocuments; web-legal-update.md).
 * From records/channels/web/<site>/legal/<type>.md: one row per version, id legal:<type>@<version>.
 *
 *  - Never deleted. A new version is a new row; publishing it marks the previous one superseded,
 *    and that text stays readable at its archive URL (/legal/<type>/<version>).
 *  - Once published, a version never changes: the only change allowed is published → superseded.
 *  - At most one published version per type per site.
 *  - Websites see published and superseded versions (current and archive), never drafts.
 */
const IMMUTABLE_IGNORED = new Set(['status', 'sync', 'updatedAt', 'createdAt', 'id', 'tenant', 'body', 'bodyMarkdown'])

const legalRules: CollectionBeforeValidateHook = async ({ data, originalDoc, req, collection, operation }) => {
  const doc = { ...originalDoc, ...data } as Record<string, unknown>
  const errors: { path: string; message: string }[] = []
  const fail = () => {
    if (errors.length) throw new ValidationError({ collection: collection.slug, errors })
  }

  if (doc.type && doc.version && doc.recordId !== `legal:${doc.type}@${doc.version}`) {
    errors.push({ path: 'recordId', message: 'A legal record id is legal:<type>@<version>.' })
  }

  if (operation === 'update' && originalDoc) {
    const was = originalDoc.status
    if (was === 'published' || was === 'superseded') {
      // The text and its metadata are frozen; only published → superseded may happen.
      for (const [key, value] of Object.entries(data ?? {})) {
        if (IMMUTABLE_IGNORED.has(key)) continue
        if (JSON.stringify(value ?? null) !== JSON.stringify(originalDoc[key] ?? null)) {
          errors.push({ path: key, message: 'A published legal version never changes; publish a new version instead.' })
        }
      }
      if (data?.bodyMarkdown !== undefined && data.bodyMarkdown !== originalDoc.bodyMarkdown) {
        errors.push({ path: 'bodyMarkdown', message: 'A published legal version never changes; publish a new version instead.' })
      }
      const next = doc.status
      if (!(next === was || (was === 'published' && next === 'superseded'))) {
        errors.push({ path: 'status', message: `A ${was} version cannot become ${String(next)}.` })
      }
    }
  }

  if (doc.status === 'published') {
    const tenant = typeof doc.tenant === 'object' && doc.tenant ? (doc.tenant as { id: unknown }).id : doc.tenant
    const where: Where[] = [{ tenant: { equals: tenant } }, { type: { equals: doc.type } }, { status: { equals: 'published' } }]
    if (originalDoc?.id !== undefined) where.push({ id: { not_equals: originalDoc.id } })
    const { totalDocs } = await req.payload.count({ collection: 'legal', overrideAccess: true, req, where: { and: where } })
    if (totalDocs > 0) errors.push({ path: 'status', message: `Another version of ${String(doc.type)} is already published; supersede it first.` })
    if (!doc.effectiveAt) errors.push({ path: 'effectiveAt', message: 'A published version has an effective date.' })
  }
  fail()
  return data
}

// A published (or archived) version is public text: it may cite public records only.
const legalReferences = publicReferences({
  collect: (d) => [d.body],
  uploads: (d) => richTextRefs(d.body),
  approved: (d) => d.status === 'published' || d.status === 'superseded',
  isPublic: () => true,
})

export const Legal: CollectionConfig = {
  slug: 'legal',
  lockDocuments: false,
  indexes: recordIndexes,
  defaultSort: 'type',
  admin: { useAsTitle: 'recordId', defaultColumns: ['type', 'version', 'status', 'effectiveAt'] },
  hooks: {
    beforeValidate: [markdownBody, sameTenantReferences((d) => richTextRefs(d.body)), legalRules, legalReferences],
    beforeChange: [bannedVocabularyBeforeChange],
  },
  access: {
    read: readContent({ publicOnly: { status: { in: ['published', 'superseded'] } } }),
    create: writeContent,
    update: writeContent,
    delete: () => false, // "No delete; publish creates a new row"
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  fields: [
    recordIdField('legal:'),
    {
      name: 'type',
      type: 'text',
      required: true,
      index: true,
      validate: (v: unknown) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(v ?? '')) ? true : 'e.g. privacy, terms, cookie, eula, ifu-<device>'),
      admin: { description: 'privacy · terms · cookie · accessibility · eula · baa · hipaa · ifu-<device> · disclosure · aup · subprocessors · ai-transparency · consumer-health-privacy' },
    },
    {
      name: 'version',
      type: 'text',
      required: true,
      validate: (v: unknown) => (/^[0-9][0-9.]*$/.test(String(v ?? '')) ? true : 'Digits and dots, e.g. 3 or 2.1.'),
    },
    { name: 'effectiveAt', type: 'text', admin: { description: 'yyyy-mm-dd' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'approved', 'published', 'superseded'].map((v) => ({ label: v, value: v })),
    },
    { name: 'material', type: 'checkbox', defaultValue: false, admin: { description: 'A material change needs 30 days’ notice (L-6).' } },
    { name: 'changeSummary', type: 'textarea' },
    { name: 'approvalRecordId', type: 'text', admin: { description: 'The ComplianceOps revision record.' } },
    { name: 'body', type: 'richText' },
    { name: 'bodyMarkdown', type: 'textarea', admin: { description: 'Markdown from the _ops record; the body is generated from it.' } },
    syncField,
  ],
}
