import {
  ValidationError,
  type Block,
  type CollectionBeforeOperationHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
} from 'payload'

import { hasRole, readContent, writeContent } from '../access/roles'
import { jsonField, recordIdField, syncField, visibilityField } from '../fields/record'
import { pageReferences } from '../hooks/pageReferences'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'
import { richTextRefs, sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Pages, mirrored from records/channels/web/<site>/pages/<slug>.md (templates/page.md):
 * a template id plus ordered blocks whose props cite claim:/atom:/asset: ids.
 *
 * Blocks: one Payload block per catalog id (metadesign/blocks-catalog.md). Header, footer and
 * the consent and preview banners come from the template and SiteSettings, so pages carry the
 * 28 content blocks only. Each block keeps its props as in the record; their exact shapes are
 * the zod schemas in packages/blocks/<id>/schema.ts (W4.2), checked by the sync and the build.
 *
 * Websites see approved, public pages only; gated pages reach a site through a gated key later.
 */
export const TEMPLATES = [
  'platform-home', 'solution-path', 'product', 'products-hub', 'platform', 'proof', 'article',
  'whats-new-entry', 'deck', 'episode', 'portal', 'trust-center', 'legal', 'contact', 'error',
] as const

export const CONTENT_BLOCKS = [
  // openers
  'hero-statement', 'media-panel', 'icon-chip-rail', 'statement',
  // proof and product
  'feature-explorer', 'product-grid', 'capability-trio', 'proof-numbers', 'clearance-strip', 'screens',
  'workflow-diagram', 'platform-map', 'logo-wall', 'quote', 'timeline',
  // audience and conversion
  'audience-showcase', 'split-cta', 'contact-form', 'newsletter', 'faq',
  // feeds and media
  'card-feed', 'article-body', 'deck-embed', 'episode-player',
  // gated and utility
  'gated-sign-in', 'document-list', 'legal-body', 'error-page',
] as const

const blocks: Block[] = CONTENT_BLOCKS.map((slug) => ({
  slug,
  fields: [jsonField('props', `Props of the ${slug} block, as in the page record.`, { required: true })],
}))

/**
 * Payload silently drops blocks with an unknown blockType before validation, which for a sync
 * would mean content vanishing without an error. Check the raw incoming data first and refuse
 * anything that is not one of the 28 content blocks (shell blocks come from SiteSettings).
 */
const knownBlocksOnly: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return args
  const blocks = (args.data as { blocks?: unknown } | undefined)?.blocks
  if (blocks === undefined) return args
  if (!Array.isArray(blocks)) {
    throw new ValidationError({ collection: 'pages', errors: [{ path: 'blocks', message: 'blocks must be a list.' }] })
  }
  const unknown = blocks
    .map((b) => (b as { blockType?: unknown })?.blockType)
    .filter((t) => !(CONTENT_BLOCKS as readonly unknown[]).includes(t))
  if (unknown.length) {
    throw new ValidationError({
      collection: 'pages',
      errors: [{ path: 'blocks', message: `Not a page block: ${unknown.map(String).join(', ')}. Header, footer and banners come from site settings.` }],
    })
  }
  return args
}

const pageRules: CollectionBeforeValidateHook = ({ data, originalDoc, collection }) => {
  const p = { ...originalDoc, ...data } as Record<string, unknown>
  const errors: { path: string; message: string }[] = []
  // One leading slash, lowercase path segments, no trailing slash (except the home page "/").
  if (typeof p.route === 'string' && !/^\/(?:[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*)?$/.test(p.route)) {
    errors.push({ path: 'route', message: 'A route is /lowercase/segments with no trailing slash.' })
  }
  if (p.template === 'product' && !p.product) errors.push({ path: 'product', message: 'A product page names its product.' })
  const seo = (p.seo ?? {}) as Record<string, unknown>
  if (p.gate && p.gate !== 'none' && seo.noindex !== true) {
    errors.push({ path: 'seo.noindex', message: 'A gated page is noindex.' })
  }
  if (p.status === 'approved') {
    const approved = (p.approved ?? {}) as Record<string, unknown>
    if (!approved.by || !approved.at) errors.push({ path: 'approved', message: 'An approved page records who approved it and when.' })
  }
  if (errors.length) throw new ValidationError({ collection: collection.slug, errors })
  return data
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  lockDocuments: false,
  indexes: [
    { fields: ['tenant', 'recordId'], unique: true },
    { fields: ['tenant', 'route'], unique: true },
  ],
  admin: { useAsTitle: 'route', defaultColumns: ['route', 'template', 'status', 'visibility'] },
  hooks: {
    beforeChange: [bannedVocabularyBeforeChange],
    beforeOperation: [knownBlocksOnly],
    beforeValidate: [sameTenantReferences((d) => richTextRefs(d.body)), pageRules, pageReferences],
  },
  access: {
    read: readContent({
      // Gated pages (investor, trust, partner) never reach a public website key.
      publicOnly: {
        and: [{ status: { equals: 'approved' } }, { visibility: { equals: 'public' } }, { gate: { equals: 'none' } }],
      },
    }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
    // No versions today; if they are ever enabled, website keys must not read them.
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  fields: [
    recordIdField('page:'),
    { name: 'template', type: 'select', required: true, options: TEMPLATES.map((v) => ({ label: v, value: v })) },
    { name: 'route', type: 'text', required: true, index: true },
    {
      name: 'product',
      type: 'text',
      validate: (v: unknown) => (!v || /^product:[a-z0-9]+(-[a-z0-9]+)*$/.test(String(v)) ? true : 'Use product:<id>.'),
      admin: { description: 'Product template only; the product must be released.' },
    },
    { name: 'blocks', type: 'blocks', blocks, admin: { description: 'In the template’s slot order.' } },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', maxLength: 60 },
        { name: 'description', type: 'textarea', maxLength: 155 },
        { name: 'canonical', type: 'text' },
        { name: 'og', type: 'text', defaultValue: 'auto', admin: { description: 'auto, or asset:<org>/og/<id>@<v>' } },
        { name: 'jsonld', type: 'text', hasMany: true },
        { name: 'sitemap', type: 'checkbox', defaultValue: true },
        { name: 'llmsTxt', type: 'checkbox', defaultValue: true },
        { name: 'noindex', type: 'checkbox', defaultValue: false },
      ],
    },
    visibilityField,
    {
      name: 'gate',
      type: 'select',
      required: true,
      defaultValue: 'none',
      options: ['none', 'investor', 'trust', 'partner'].map((v) => ({ label: v, value: v })),
    },
    { name: 'owner', type: 'text', admin: { description: 'Position that owns the page (completeness area 3).' } },
    { name: 'reviewBy', type: 'text', admin: { description: 'yyyy-mm-dd' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'approved', 'retired'].map((v) => ({ label: v, value: v })),
    },
    {
      name: 'approved',
      type: 'group',
      admin: { description: 'marketing.head approves the exact version.' },
      fields: [
        { name: 'by', type: 'text' },
        { name: 'at', type: 'text' },
        { name: 'version', type: 'text' },
      ],
    },
    { name: 'body', type: 'richText', admin: { description: 'Long-form text for article-body or legal-body pages only.' } },
    syncField,
  ],
}
