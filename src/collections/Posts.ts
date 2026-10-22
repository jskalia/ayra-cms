import { ValidationError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { hasRole, readContent, writeContent } from '../access/roles'
import { internalRead, recordIdField, syncField, visibilityField } from '../fields/record'
import { bannedVocabularyBeforeChange } from '../hooks/bannedVocabulary'
import { markdownBody } from '../hooks/markdownBody'
import { publicReferences } from '../hooks/pageReferences'
import { richTextRefs, sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Blog posts (processes/web-blog-post.md): records/channels/web/<site>/pages/blog/<slug>.md,
 * a page record with the article template, cited as post:<slug> and rendered by article-body
 * and card-feed. A post is cited and answer-first; BlogPosting JSON-LD needs a real Person
 * author; marketing.head approves the exact version. The sync turns the Markdown body into
 * rich text.
 *
 * Websites see approved, public posts only; an approved public post may cite public records only.
 */
const postRules: CollectionBeforeValidateHook = ({ data, originalDoc, collection }) => {
  const p = { ...originalDoc, ...data } as Record<string, unknown>
  const errors: { path: string; message: string }[] = []
  if (p.slug && p.recordId !== `post:${p.slug}`) {
    errors.push({ path: 'recordId', message: 'A post’s record id is post:<slug>.' })
  }
  if (p.status === 'approved') {
    const approved = (p.approved ?? {}) as Record<string, unknown>
    if (!approved.by || !approved.at) errors.push({ path: 'approved', message: 'An approved post records who approved it and when.' })
    const author = (p.author ?? {}) as Record<string, unknown>
    if (!author.name) errors.push({ path: 'author.name', message: 'An approved post names a real author (BlogPosting JSON-LD).' })
  }
  if (errors.length) throw new ValidationError({ collection: collection.slug, errors })
  return data
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  lockDocuments: false,
  defaultSort: '-publishedAt',
  // The slug is unique within a site; recordId is post:<slug>, so it is unique too.
  indexes: [{ fields: ['tenant', 'slug'], unique: true }],
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'status', 'publishedAt', 'visibility'] },
  hooks: {
    beforeValidate: [
      markdownBody,
      sameTenantReferences((d) => richTextRefs(d.body)),
      postRules,
      publicReferences({
        collect: (p) => [p.heroAsset, p.cites, p.seo, p.body],
        uploads: (p) => richTextRefs(p.body),
        approved: (p) => p.status === 'approved',
        isPublic: (p) => p.visibility === 'public',
      }),
    ],
    beforeChange: [bannedVocabularyBeforeChange],
  },
  access: {
    read: readContent({
      publicOnly: { and: [{ status: { equals: 'approved' } }, { visibility: { equals: 'public' } }] },
    }),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
    // No versions today; if they are ever enabled, website keys must not read them.
    readVersions: hasRole('admin', 'editor', 'sync'),
  },
  fields: [
    recordIdField('post:'),
    { name: 'slug', type: 'text', required: true, index: true, admin: { description: 'URL segment: /blog/<slug>.' } },
    { name: 'title', type: 'text', required: true },
    { name: 'excerpt', type: 'textarea', admin: { description: 'Card and listing text.' } },
    { name: 'body', type: 'richText', admin: { description: 'Diagram first; every factual line cites a claim.' } },
    {
      name: 'bodyMarkdown',
      type: 'textarea',
      admin: { description: 'Markdown from the _ops record; the body above is generated from it.' },
    },
    {
      name: 'author',
      type: 'group',
      admin: { description: 'A real person, for BlogPosting JSON-LD.' },
      fields: [
        { name: 'name', type: 'text' },
        { name: 'jobTitle', type: 'text' },
        { name: 'url', type: 'text' },
        { name: 'sameAs', type: 'text', hasMany: true },
      ],
    },
    { name: 'tags', type: 'text', hasMany: true },
    { name: 'publishedAt', type: 'date', index: true },
    { name: 'heroAsset', type: 'text', admin: { description: 'asset:<org>/<kind>/<id>@<v>' } },
    { name: 'cites', type: 'text', hasMany: true, admin: { description: 'claim:/atom: ids the post cites.' } },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', maxLength: 60 },
        { name: 'description', type: 'textarea', maxLength: 155 },
        { name: 'canonical', type: 'text' },
        { name: 'og', type: 'text', defaultValue: 'auto' },
        { name: 'noindex', type: 'checkbox', defaultValue: false },
      ],
    },
    visibilityField,
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
      fields: [
        { name: 'by', type: 'text' },
        { name: 'at', type: 'text' },
        { name: 'version', type: 'text' },
      ],
    },
    { name: 'owner', type: 'text' },
    { name: 'reviewBy', type: 'text' },
    {
      name: 'origin',
      type: 'select',
      defaultValue: 'ops',
      options: [
        { label: 'Synced from _ops', value: 'ops' },
        { label: 'AyraAgent Blogs', value: 'ayra-blogs' },
      ],
      admin: { description: 'Where the post was written.' },
    },
    { name: 'externalId', type: 'text', index: true, access: internalRead, admin: { description: 'The AyraAgent blog id.' } },
    {
      name: 'sources',
      type: 'json',
      access: internalRead,
      admin: { description: 'Files the AyraAgent blog cites (internal: never sent to websites).' },
    },
    syncField,
  ],
}
