import { ValidationError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { hasRole } from '../access/roles'
import { sameTenantReferences } from '../hooks/sameTenantReferences'

/**
 * Cookie-consent records (web-consent.md; DR-13 stopgap until Core consent lands): the same
 * schema on every site, written at runtime by the site's server with its website key (the only
 * thing a website key may write). Anonymous id, choices, policy version, GPC flag, time.
 * NO personal data: anything that looks like an email address or a phone number is refused.
 * Retention is set by the privacy owner (to do). People read them; nobody edits or deletes.
 */
const PERSONAL = [/[^\s@]+@[^\s@]+\.[a-z]{2,}/i, /\+?\d[\d\s().-]{7,}\d/]

// The anonymous id is random letters and digits (its pattern rules out an email address, and a
// digit run there is not a phone number), so the free text to check is the choices.
const noPersonalData: CollectionBeforeValidateHook = ({ data, collection }) => {
  const text = JSON.stringify(data?.choices ?? {})
  if (PERSONAL.some((p) => p.test(text))) {
    throw new ValidationError({ collection: collection.slug, errors: [{ path: 'choices', message: 'Consent records hold no personal data.' }] })
  }
  return data
}

export const ConsentRecords: CollectionConfig = {
  slug: 'consent-records',
  lockDocuments: false,
  defaultSort: '-recordedAt',
  admin: { useAsTitle: 'anonymousId', defaultColumns: ['anonymousId', 'policyVersion', 'gpc', 'recordedAt'] },
  hooks: { beforeValidate: [sameTenantReferences(), noPersonalData] },
  access: {
    read: hasRole('admin', 'editor'),
    create: hasRole('site-reader'), // the site's server, with its website key
    update: () => false,
    delete: () => false,
    readVersions: () => false,
  },
  fields: [
    {
      name: 'anonymousId',
      type: 'text',
      required: true,
      index: true,
      validate: (v: unknown) => (/^[A-Za-z0-9_-]{16,64}$/.test(String(v ?? '')) ? true : 'A random id of 16–64 letters, digits, - or _.'),
    },
    {
      name: 'choices',
      type: 'json',
      required: true,
      admin: { description: 'Category → true/false, e.g. {"analytics": false, "marketing": false}.' },
      validate: (v: unknown) =>
        v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'boolean')
          ? true
          : 'An object of category → true/false.',
    },
    { name: 'policyVersion', type: 'text', required: true },
    { name: 'gpc', type: 'checkbox', defaultValue: false, admin: { description: 'Global Privacy Control signal was present.' } },
    {
      name: 'region',
      type: 'select',
      options: ['us', 'eu-uk', 'other'].map((v) => ({ label: v, value: v })),
      admin: { description: 'Which default applied (W9.0).' },
    },
    { name: 'recordedAt', type: 'date', required: true, defaultValue: () => new Date().toISOString(), index: true },
  ],
}
