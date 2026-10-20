/** Phase 4c: verify a site against a receipt, and roll back to an earlier _ops commit. */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LocalClient, type CmsClient } from '../src/sync/client'
import { runSync } from '../src/sync/run'
import { snapshotAt, verifyReceipt, type Receipt } from '../src/sync/verify'
import { ctx, recordIds, setup, teardown } from './setup'

const FIXTURE = path.resolve(__dirname, 'fixtures/ops/_demo_ops')
let ops: string
let client: CmsClient
const git = (...args: string[]) =>
  execFileSync('git', ['-C', ops, '-c', 'user.email=test@example.test', '-c', 'user.name=Test', ...args]).toString().trim()

beforeAll(async () => {
  await setup()
  ops = mkdtempSync(path.join(os.tmpdir(), 'ops-git-'))
  cpSync(FIXTURE, ops, { recursive: true })
  git('init', '-q')
  git('add', '-A')
  git('commit', '-q', '-m', 'first')
  const { docs } = await ctx.payload.find({ collection: 'tenants', where: { slug: { equals: 'ayraagent' } } })
  for (const [name, role] of [['syncDemo', 'sync'], ['viewerDemo', 'editor']]) {
    ctx.users[name] = (await ctx.payload.create({
      collection: 'users',
      data: { name, role, email: `${name}@example.test`, password: 'test-only-password', tenants: [{ tenant: docs[0].id }] } as never,
    })) as never
  }
  client = new LocalClient(ctx.payload, { ...ctx.users.syncDemo, collection: 'users' } as unknown as TypedUser)
}, 180_000)
afterAll(async () => {
  rmSync(ops, { recursive: true, force: true })
  await teardown()
})

const sync = (extra: Partial<Parameters<typeof runSync>[0]> = {}) =>
  runSync({ orgRoot: ops, site: 'demo', tenant: 'ayraagent', client, actor: 'test-runner', ...extra })
const readReceipt = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Receipt

describe('verify and roll back', () => {
  let first: Receipt
  let firstCommit: string

  it('a fresh receipt matches the site', async () => {
    const r = await sync()
    expect(r.ok).toBe(true)
    first = readReceipt(r.receiptPath!)
    firstCommit = git('rev-parse', 'HEAD')
    expect(first.items).toHaveLength(12)
    const v = await verifyReceipt(client, 'ayraagent', first)
    expect(v).toMatchObject({ ok: true, matched: 12, changed: [], missing: [] })
  })

  it('after a later change, the old receipt shows exactly what differs', async () => {
    const claims = path.join(ops, 'marketing/records/products/widget/claims.json')
    const file = JSON.parse(readFileSync(claims, 'utf8'))
    file.claims[1].quote = 'under half a second'
    file.claims.push({ ...file.claims[0], id: 'widget-new-001', text: 'A new public fact.' })
    writeFileSync(claims, JSON.stringify(file, null, 2) + '\n')
    git('commit', '-qam', 'second')
    expect((await sync()).ok).toBe(true)

    const v = await verifyReceipt(client, 'ayraagent', first)
    expect(v.ok).toBe(false)
    expect(v.changed.map((c) => c.recordId)).toEqual(['claim:widget-speed-001'])
    expect(v.missing).toEqual([])
  })

  it('rolling back to the first commit restores it; the later record is reported, not deleted', async () => {
    const snapshot = snapshotAt(ops, firstCommit)
    try {
      const r = await sync({ orgRoot: snapshot, receiptRoot: ops, opsCommit: firstCommit })
      expect(r.ok).toBe(true)
      expect(r.items.filter((i) => i.action === 'update').map((i) => i.recordId)).toEqual(['claim:widget-speed-001'])
      expect(r.orphans.map((o) => o.recordId)).toEqual(['claim:widget-new-001'])
      expect(r.receiptPath!.startsWith(ops)).toBe(true) // filed in the real _ops, not the snapshot
      expect(readReceipt(r.receiptPath!)).toMatchObject({ opsCommit: firstCommit })
    } finally {
      rmSync(snapshot, { recursive: true, force: true })
    }
    expect((await verifyReceipt(client, 'ayraagent', first)).ok).toBe(true)
    expect(await recordIds('claims', 'viewerDemo')).toContain('claim:widget-new-001')
  })

  it('a receipt can be fetched from the CMS by id and verified', async () => {
    const stored = (await client.receipt(await client.tenantId('ayraagent'), first.receiptId)) as unknown as Receipt
    expect(stored.receiptId).toBe(first.receiptId)
    expect((await verifyReceipt(client, 'ayraagent', stored)).ok).toBe(true)
  })

  it('snapshots refuse anything that is not a git commit name', () => {
    expect(() => snapshotAt(ops, 'HEAD; rm -rf /')).toThrow(/not a git commit/)
    expect(existsSync(ops)).toBe(true)
  })
})
