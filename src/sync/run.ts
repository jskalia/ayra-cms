/**
 * Phase 4b: the one-way sync, _ops → one site's tenant (WebsiteOps plan W5.4, S-1, S-8).
 *
 *  1. Read the snapshot and check it whole (src/sync/check.ts). Any problem: nothing is written.
 *  2. Plan: for each record, create / update / unchanged, by record id and the sha256 of its
 *     canonical content (stored on the CMS document as sync.sourceSha256).
 *  3. Dry run stops here. Otherwise write in dependency order, then file a receipt: in the CMS
 *     (sync-receipts) and back in _ops (marketing/receipts/sync/<site>/<receipt>.json).
 *  4. Never delete. Records in the site that are no longer in _ops are reported as orphans.
 *
 * A failed write stops the run; the receipt is still filed (status failed) with what was done,
 * and re-running is safe because unchanged records are skipped.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { checkSchemas, checkSnapshot } from './check'
import type { CmsClient } from './client'
import { readOps, WRITE_ORDER, type SyncCollection, type SyncRecord } from './read'

export type Action = 'create' | 'update' | 'unchanged'
export type Item = { collection: SyncCollection; recordId: string; sourcePath: string; sha256: string; action: Action }
export type SyncResult = {
  ok: boolean
  dryRun: boolean
  problems: string[]
  items: Item[]
  orphans: { collection: SyncCollection; recordId: string }[]
  counts: Record<Action, number>
  receiptId?: string
  revision?: number
  receiptPath?: string
  error?: string
}
export type SyncOptions = {
  orgRoot: string
  site: string
  tenant: string
  client: CmsClient
  actor: string
  dryRun?: boolean
  schemasDir?: string
  /** Write the receipt back into _ops (default true; off in some tests). */
  receiptToOps?: boolean
  /** Where the receipt goes in _ops when reading from a snapshot (rollback): the real org folder. */
  receiptRoot?: string
  /** The _ops commit the snapshot was taken at (rollback). */
  opsCommit?: string
  now?: () => Date
}

const opsCommit = (orgRoot: string) => {
  try {
    return execFileSync('git', ['-C', orgRoot, 'rev-parse', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return undefined
  }
}
const countOf = (items: Item[]) =>
  items.reduce((c, i) => ({ ...c, [i.action]: c[i.action] + 1 }), { create: 0, update: 0, unchanged: 0 } as Record<Action, number>)

export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const now = opts.now ?? (() => new Date())
  const startedAt = now()
  const empty = (problems: string[]): SyncResult => ({
    ok: false, dryRun: Boolean(opts.dryRun), problems, items: [], orphans: [], counts: countOf([]),
  })
  if (!opts.actor?.trim()) return empty(['a sync is started by a person: give --actor'])

  // 1. Read and check the whole snapshot.
  const { records, problems: readProblems } = readOps(opts.orgRoot, opts.site)
  const problems = [...readProblems, ...checkSnapshot(records)]
  if (opts.schemasDir) problems.push(...(await checkSchemas(opts.orgRoot, records, opts.schemasDir)))
  if (problems.length) return empty(problems)

  // 2. Plan against what the tenant holds.
  const tenant = await opts.client.tenantId(opts.tenant)
  const plan: { record: SyncRecord; action: Action; id?: number | string }[] = []
  const orphans: SyncResult['orphans'] = []
  for (const collection of WRITE_ORDER) {
    const existing = await opts.client.existing(collection, tenant)
    const mine = records.filter((r) => r.collection === collection)
    for (const record of mine) {
      const found = existing.get(record.recordId)
      plan.push({ record, id: found?.id, action: !found ? 'create' : found.sha === record.sha256 ? 'unchanged' : 'update' })
    }
    const ids = new Set(mine.map((r) => r.recordId))
    for (const recordId of existing.keys()) if (!ids.has(recordId)) orphans.push({ collection, recordId })
  }
  const item = (p: (typeof plan)[number]): Item => ({
    collection: p.record.collection, recordId: p.record.recordId, sourcePath: p.record.sourcePath, sha256: p.record.sha256, action: p.action,
  })
  if (opts.dryRun) {
    const items = plan.map(item)
    return { ok: true, dryRun: true, problems: [], items, orphans, counts: countOf(items) }
  }

  // 3. Write in order, then file the receipt.
  const revision = (await opts.client.lastRevision(tenant)) + 1
  const receiptId = `${startedAt.toISOString().replace(/[-:]/g, '').replace(/\..+/, '')}-${opts.site}-r${revision}-${randomBytes(3).toString('hex')}`
  const done: Item[] = []
  let error: string | undefined
  for (const p of plan) {
    if (p.action === 'unchanged') {
      done.push(item(p))
      continue
    }
    const data = {
      ...p.record.data,
      tenant,
      sync: { sourcePath: p.record.sourcePath, sourceSha256: p.record.sha256, receipt: receiptId, syncedAt: now().toISOString() },
    }
    try {
      if (p.action === 'create') await opts.client.create(p.record.collection, data, p.record.file)
      else await opts.client.update(p.record.collection, p.id!, data, p.record.file)
      done.push(item(p))
    } catch (err) {
      error = `${p.record.sourcePath} ${p.record.recordId}: ${err instanceof Error ? err.message : String(err)}`
      break
    }
  }

  const receipt = {
    receiptId, revision, status: error ? 'failed' : 'ok', tenant,
    startedAt: startedAt.toISOString(), finishedAt: now().toISOString(), actor: opts.actor,
    sourceRoot: opts.receiptRoot ?? opts.orgRoot, opsCommit: opts.opsCommit ?? opsCommit(opts.orgRoot),
    counts: countOf(done), items: done, orphans, error,
  }
  await opts.client.createReceipt(receipt)
  let receiptPath: string | undefined
  if (opts.receiptToOps !== false) {
    const dir = path.join(opts.receiptRoot ?? opts.orgRoot, 'marketing', 'receipts', 'sync', opts.site)
    mkdirSync(dir, { recursive: true })
    receiptPath = path.join(dir, `${receiptId}.json`)
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n')
  }
  return {
    ok: !error, dryRun: false, problems: [], items: done, orphans, counts: countOf(done), receiptId, revision, receiptPath, error,
  }
}
