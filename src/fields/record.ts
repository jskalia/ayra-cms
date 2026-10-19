import type { Field, FieldAccess } from 'payload'

/**
 * Fields every synced record carries (WebsiteOps plan S-1, S-8, W5.4: content enters only by
 * the one-way, receipted sync from _ops).
 *
 *  recordId   the record's id in _ops, in its citable form: page:<org>/<slug>, claim:<id>,
 *             atom:<id>, product:<id>, asset:<org>/<kind>/<id>@<v>, site:<site>. Unique per tenant.
 *  sync       where the record came from and which sync wrote it, so a receipt's hashes can be
 *             checked against the tenant.
 */
export const recordIdField = (prefix: string): Field => ({
  name: 'recordId',
  type: 'text',
  required: true,
  index: true,
  admin: { description: `The record's id in _ops (${prefix}…). Unique within a site.` },
  validate: (value: unknown) =>
    typeof value === 'string' && value.startsWith(prefix) && value.length > prefix.length
      ? true
      : `Must start with "${prefix}".`,
})

export const syncField: Field = {
  name: 'sync',
  type: 'group',
  admin: { description: 'Written by the _ops sync.' },
  fields: [
    { name: 'sourcePath', type: 'text', admin: { description: 'Path of the source record in _ops.' } },
    { name: 'sourceSha256', type: 'text', validate: sha256OrEmpty },
    { name: 'receipt', type: 'text', admin: { description: 'Id of the sync receipt that wrote this version.' } },
    { name: 'syncedAt', type: 'date' },
  ],
}

export const visibilityField: Field = {
  name: 'visibility',
  type: 'select',
  required: true,
  defaultValue: 'internal',
  options: [
    { label: 'Public', value: 'public' },
    { label: 'Internal', value: 'internal' },
    { label: 'Investor-only', value: 'investor-only' },
  ],
  admin: { description: 'Websites only ever see public records (G-SITE-7).' },
}

/** Status of a promoted (records/) claim or atom: needs-owner never leaves work/. */
export const recordStatusField: Field = {
  name: 'status',
  type: 'select',
  required: true,
  defaultValue: 'active',
  options: [
    { label: 'Active', value: 'active' },
    { label: 'Deprecated', value: 'deprecated' },
    { label: 'Retired', value: 'retired' },
  ],
}

function sha256OrEmpty(value: unknown): true | string {
  if (value === undefined || value === null || value === '') return true
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? true : 'Must be a 64-character sha256 hex string.'
}

export const sha256Field = (name: string, required = false): Field => ({
  name,
  type: 'text',
  required,
  validate: (value: unknown) => (required && !value ? 'Required.' : sha256OrEmpty(value)),
})

/** A JSON field that must hold an object (or an array, when `array` is set). */
export const jsonField = (
  name: string,
  description: string,
  opts: { array?: boolean; required?: boolean; access?: { read?: FieldAccess } } = {},
): Field => ({
  name,
  type: 'json',
  required: opts.required,
  access: opts.access,
  admin: { description },
  validate: (value: unknown) => {
    if (value === undefined || value === null) return opts.required ? 'Required.' : true
    if (opts.array) return Array.isArray(value) ? true : 'Must be a list.'
    return typeof value === 'object' && !Array.isArray(value) ? true : 'Must be an object.'
  },
})

/** recordId is unique within a tenant. */
export const recordIndexes = [{ fields: ['tenant', 'recordId'], unique: true }]
