import type { CollectionConfig } from 'payload'

import { hasRole } from '../access/roles'

/**
 * One receipt per sync run (WebsiteOps plan W5.4, S-8: "content enters only by receipted sync").
 * Write-once: the sync creates it, nobody edits or deletes it. Each item records the source
 * path and sha256 of a record and what the run did with it, so the site's content can be checked
 * against a receipt (`--verify`) and an earlier state restored by re-syncing an older snapshot.
 * The same receipt is also written back into _ops.
 */
export const SyncReceipts: CollectionConfig = {
  slug: 'sync-receipts',
  lockDocuments: false,
  defaultSort: '-revision',
  indexes: [{ fields: ['tenant', 'receiptId'], unique: true }],
  admin: { useAsTitle: 'receiptId', defaultColumns: ['receiptId', 'revision', 'status', 'finishedAt'] },
  access: {
    read: hasRole('admin', 'editor', 'sync'),
    create: hasRole('sync'),
    update: () => false,
    delete: () => false,
    readVersions: () => false,
  },
  fields: [
    { name: 'receiptId', type: 'text', required: true, index: true },
    { name: 'revision', type: 'number', required: true, admin: { description: 'Increases by one with every run for this site.' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'OK', value: 'ok' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'startedAt', type: 'date', required: true },
    { name: 'finishedAt', type: 'date', required: true },
    { name: 'actor', type: 'text', required: true, admin: { description: 'The person who ran the sync.' } },
    { name: 'sourceRoot', type: 'text', admin: { description: 'The _ops org folder that was read.' } },
    { name: 'opsCommit', type: 'text', admin: { description: 'git commit of _ops at read time, when available.' } },
    { name: 'counts', type: 'json' },
    { name: 'items', type: 'json', admin: { description: '[{collection, recordId, sourcePath, sha256, action}]' } },
    { name: 'orphans', type: 'json', admin: { description: 'Records in the site but no longer in _ops (reported, never deleted).' } },
    { name: 'error', type: 'textarea' },
  ],
}
