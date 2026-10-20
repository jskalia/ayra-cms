/**
 * Phase 4c: verify and roll back (WebsiteOps plan W5.4 receipts; r08-prove: "the rollback
 * rehearsal restores the prior preview and the prior content receipt").
 *
 * verifyReceipt: does the site still hold exactly what a receipt says? For every item it compares
 * the record's sha256 in the site with the receipt's, and reports what changed since (and which
 * later receipt changed it) or went missing.
 *
 * snapshotAt: extracts the org folder as it was at an _ops git commit into a temporary folder,
 * so a normal sync from it restores that state. Records added later are never deleted; the sync
 * reports them as orphans for a person to retire in _ops.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { CmsClient } from './client'
import type { SyncCollection } from './read'
import type { Item } from './run'

export type Receipt = { receiptId: string; revision: number; status: string; items: Item[] }
export type VerifyResult = {
  ok: boolean
  receiptId: string
  matched: number
  changed: { collection: SyncCollection; recordId: string; expected: string; actual?: string }[]
  missing: { collection: SyncCollection; recordId: string }[]
}

export async function verifyReceipt(client: CmsClient, tenantSlug: string, receipt: Receipt): Promise<VerifyResult> {
  const tenant = await client.tenantId(tenantSlug)
  const byCollection = new Map<SyncCollection, Item[]>()
  for (const item of receipt.items) byCollection.set(item.collection, [...(byCollection.get(item.collection) ?? []), item])

  const result: VerifyResult = { ok: true, receiptId: receipt.receiptId, matched: 0, changed: [], missing: [] }
  for (const [collection, items] of byCollection) {
    const existing = await client.existing(collection, tenant)
    for (const item of items) {
      const found = existing.get(item.recordId)
      if (!found) result.missing.push({ collection, recordId: item.recordId })
      else if (found.sha !== item.sha256) result.changed.push({ collection, recordId: item.recordId, expected: item.sha256, actual: found.sha })
      else result.matched += 1
    }
  }
  result.ok = result.changed.length === 0 && result.missing.length === 0
  return result
}

/** The org folder as it was at `commit` (any git tree-ish), extracted to a temporary folder. */
export function snapshotAt(orgRoot: string, commit: string): string {
  if (!/^[\w./-]+$/.test(commit)) throw new Error(`not a git commit: ${commit}`)
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ops-snapshot-'))
  // "<commit>:./" is the tree of orgRoot itself, so paths stay relative to the org folder.
  const tar = execFileSync('git', ['-C', orgRoot, 'archive', '--format=tar', `${commit}:./`], { maxBuffer: 1024 * 1024 * 1024 })
  execFileSync('tar', ['-x', '-C', dir], { input: tar })
  return dir
}
