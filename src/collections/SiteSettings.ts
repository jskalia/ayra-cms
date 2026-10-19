import type { CollectionConfig } from 'payload'

import { fieldHasRole, readContent, writeContent } from '../access/roles'
import { jsonField, recordIdField, syncField } from '../fields/record'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * One per site: the CMS mirror of records/channels/web/<site>/site.yaml (templates/site.yaml,
 * SaaS F-WEB-02 "CMS mirror"). Values are ids and positions, never copy prose; no secrets
 * (env var names only). Nested parts the site reads as a whole (nav, footer, ui strings,
 * modules) are kept as in the record. Owners, approvers and the redesign state are internal:
 * a website key cannot read them.
 */
const internalOnly = { read: fieldHasRole('admin', 'editor', 'sync') }

export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  lockDocuments: false,
  // Exactly one per site: the plugin's isGlobal makes the tenant column unique in the database.
  admin: { useAsTitle: 'recordId', description: 'One per site, from its site.yaml.' },
  hooks: { beforeValidate: [sameTenantReferences()] },
  access: {
    read: readContent(),
    create: writeContent,
    update: writeContent,
    delete: writeContent,
  },
  fields: [
    recordIdField('site:'),
    { name: 'org', type: 'text', required: true },
    { name: 'brand', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Preview', value: 'preview' },
        { label: 'Live', value: 'live' },
      ],
      admin: { description: 'live only after R9, set by a person; drives the preview banner.' },
    },
    { name: 'look', type: 'text', defaultValue: 'house-style' },
    {
      name: 'domains',
      type: 'group',
      fields: [
        { name: 'primary', type: 'text' },
        {
          name: 'www',
          type: 'select',
          defaultValue: 'redirect-to-apex',
          options: [
            { label: 'Redirect to apex', value: 'redirect-to-apex' },
            { label: 'Serve', value: 'serve' },
          ],
        },
        {
          name: 'redirects',
          type: 'array',
          fields: [
            { name: 'domain', type: 'text', required: true },
            {
              name: 'rule',
              type: 'select',
              required: true,
              options: [
                { label: 'Keep path', value: 'keep-path' },
                { label: 'To path', value: 'to-path' },
              ],
            },
            { name: 'target', type: 'text' },
            { name: 'keepServed', type: 'text', hasMany: true },
          ],
        },
      ],
    },
    { name: 'releaseSources', type: 'text', hasMany: true, admin: { description: 'product ids whose releases feed What’s New.' } },
    {
      name: 'kit',
      type: 'group',
      fields: [
        { name: 'path', type: 'text' },
        { name: 'section', type: 'text' },
        { name: 'systemId', type: 'text' },
        { name: 'version', type: 'text' },
        { name: 'approved', type: 'checkbox', defaultValue: false },
      ],
    },
    jsonField('nav', 'site.yaml nav (Platform · Solutions · Products · Proof · Resources).', { array: true }),
    jsonField('navCta', 'site.yaml nav_cta.'),
    jsonField('footer', 'site.yaml footer.'),
    {
      name: 'legalSet',
      type: 'array',
      fields: [
        { name: 'type', type: 'text', required: true },
        { name: 'page', type: 'text' },
        { name: 'version', type: 'text' },
        {
          name: 'counsel',
          type: 'select',
          defaultValue: 'draft',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Approved', value: 'approved' },
          ],
        },
        { name: 'generatedFrom', type: 'text' },
      ],
    },
    {
      name: 'forms',
      type: 'array',
      fields: [
        { name: 'formId', type: 'text', required: true },
        {
          name: 'purpose',
          type: 'select',
          options: ['contact', 'demo', 'newsletter', 'whitepaper', 'investor-signup', 'trust-signup'].map((v) => ({
            label: v,
            value: v,
          })),
        },
        { name: 'inbox', type: 'text' },
        { name: 'inboxOwner', type: 'text' },
        { name: 'slaHours', type: 'number' },
        { name: 'confirmationEmail', type: 'checkbox' },
        { name: 'sendAdapter', type: 'text' },
        { name: 'spam', type: 'text', hasMany: true },
        { name: 'noticeAtCollection', type: 'text' },
        { name: 'asksHealthInformation', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'channels',
      type: 'array',
      fields: [
        { name: 'channelId', type: 'text', required: true },
        { name: 'url', type: 'text' },
        { name: 'owner', type: 'text' },
      ],
    },
    {
      name: 'consent',
      type: 'group',
      fields: [
        { name: 'register', type: 'text' },
        { name: 'notice', type: 'text' },
        jsonField('defaults', 'e.g. {us: opt-out, gpc: honoured, eu_uk: opt-in}'),
        { name: 'policyVersion', type: 'text' },
      ],
    },
    jsonField('ui', 'Every UI string, keyed by id (no copy in code, G-SITE-6).'),
    jsonField('modules', 'Enabled modules (investor portal, trust center, decks, changelog, podcast).'),
    { name: 'retiring', type: 'text', hasMany: true },
    jsonField('owners', 'Positions (internal).', { access: internalOnly }),
    jsonField('approvers', 'Approvers by gate (internal).', { access: internalOnly }),
    jsonField('redesign', 'R0…R10 state (internal).', { access: internalOnly }),
    syncField,
  ],
}
