/** Phase 4b: the sync writing into a real (throwaway) CMS database, as the sync account. */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LocalClient, type CmsClient } from '../src/sync/client'
import { runSync } from '../src/sync/run'
import { ctx, recordIds, setup, teardown, visible } from './setup'

const FIXTURE = path.resolve(__dirname, 'fixtures/ops/_demo_ops')
let ops: string

beforeAll(async () => {
  await setup()
  ops = mkdtempSync(path.join(os.tmpdir(), 'ops-'))
  cpSync(FIXTURE, ops, { recursive: true })
  // A clean site for the sample org: the ayraagent tenant, with its own accounts.
  const { docs } = await ctx.payload.find({ collection: 'tenants', where: { slug: { equals: 'ayraagent' } } })
  const tenant = docs[0].id
  for (const [name, role] of [['syncDemo', 'sync'], ['readerDemo', 'site-reader'], ['viewerDemo', 'editor']]) {
    ctx.users[name] = (await ctx.payload.create({
      collection: 'users',
      data: { name, role, email: `${name}@example.test`, password: 'test-only-password', tenants: [{ tenant }] } as never,
    })) as never
  }
}, 180_000)
afterAll(async () => {
  rmSync(ops, { recursive: true, force: true })
  await teardown()
})

const asSync = (who: 'syncDemo' | 'syncB'): CmsClient =>
  new LocalClient(ctx.payload, { ...ctx.users[who], collection: 'users' } as unknown as TypedUser)
const sync = (extra: Partial<Parameters<typeof runSync>[0]> = {}) =>
  runSync({ orgRoot: ops, site: 'demo', tenant: 'ayraagent', client: asSync('syncDemo'), actor: 'test-runner', ...extra })
const edit = (rel: string, fn: (s: string) => string) => {
  const p = path.join(ops, 'marketing/records', rel)
  writeFileSync(p, fn(readFileSync(p, 'utf8')))
}

describe('the sync, _ops → the demo site', () => {
  it('a dry run plans every record as new and writes nothing', async () => {
    const before = await recordIds('claims', 'viewerDemo')
    const r = await sync({ dryRun: true })
    expect(r.ok).toBe(true)
    expect(r.counts).toEqual({ create: 12, update: 0, unchanged: 0, supersede: 0 })
    expect(await recordIds('claims', 'viewerDemo')).toEqual(before)
    expect(r.receiptId).toBeUndefined()
  })

  it('the first run creates every record and files a receipt in the CMS and in _ops', async () => {
    const r = await sync()
    expect(r.ok).toBe(true)
    expect(r.counts).toEqual({ create: 12, update: 0, unchanged: 0, supersede: 0 })
    expect(r.revision).toBe(1)
    const receipts = await visible('sync-receipts', 'viewerDemo')
    expect(receipts.map((x) => x.receiptId)).toEqual([r.receiptId])
    expect(existsSync(r.receiptPath!)).toBe(true)
    const onDisk = JSON.parse(readFileSync(r.receiptPath!, 'utf8'))
    expect(onDisk.items).toHaveLength(12)
    expect(onDisk.actor).toBe('test-runner')
  })

  it('what reached the site obeys the firewall', async () => {
    expect(await recordIds('pages', 'readerDemo')).toEqual(['page:demo/home', 'page:demo/products-widget'])
    const claims = await recordIds('claims', 'readerDemo')
    expect(claims).toContain('claim:widget-overview-001')
    expect(claims).not.toContain('claim:widget-roadmap-001') // investor-only
    expect(await recordIds('atoms', 'readerDemo')).toContain('atom:widget-flow-001')
    expect(await recordIds('atoms', 'readerDemo')).not.toContain('atom:widget-plan-001')
    expect(await recordIds('media', 'readerDemo')).toContain('asset:demo/screen/widget-home@1')
    const [settings] = (await visible('site-settings', 'readerDemo')) as Record<string, any>[]
    expect(settings.recordId).toBe('site:demo')
    expect(settings.owners).toBeUndefined()
    const [release] = (await visible('whats-new', 'readerDemo')).filter((x) => x.recordId === 'release:demo/2026-widget-launch') as Record<string, any>[]
    expect(release.features ?? []).toEqual([])
  })

  it('a blog post’s Markdown becomes rich text', async () => {
    const [post] = (await visible('posts', 'readerDemo')).filter((p) => p.recordId === 'post:hello-world') as Record<string, any>[]
    const text = JSON.stringify(post.body)
    expect(post.body.root.children.length).toBeGreaterThan(1)
    expect(text).toContain('Why it matters')
    expect(text).toContain('"type":"heading"')
    expect(text).toContain('"type":"list"')
  })

  it('a second run changes nothing (idempotent)', async () => {
    const before = (await visible('claims', 'viewerDemo')).map((c) => [c.recordId, c.updatedAt])
    const r = await sync()
    expect(r.counts).toEqual({ create: 0, update: 0, unchanged: 12, supersede: 0 })
    expect(r.revision).toBe(2)
    expect((await visible('claims', 'viewerDemo')).map((c) => [c.recordId, c.updatedAt])).toEqual(before)
  })

  it('a changed record is the only one updated', async () => {
    edit('products/widget/claims.json', (s) => s.replace('"quote": "under one second"', '"quote": "under half a second"'))
    const r = await sync()
    expect(r.items.filter((i) => i.action !== 'unchanged').map((i) => `${i.action} ${i.recordId}`)).toEqual(['update claim:widget-speed-001'])
    const [c] = (await visible('claims', 'readerDemo')).filter((x) => x.recordId === 'claim:widget-speed-001') as Record<string, any>[]
    expect(c.text).toBe('Widget answers in under one second.') // text unchanged; the quote changed
    const [full] = (await visible('claims', 'viewerDemo')).filter((x) => x.recordId === 'claim:widget-speed-001') as Record<string, any>[]
    expect(full.quote).toBe('under half a second')
    expect(full.sync.receipt).toBe(r.receiptId)
  })

  it('records in the site but not in _ops are reported, never deleted', async () => {
    const { docs } = await ctx.payload.find({ collection: 'tenants', where: { slug: { equals: 'ayraagent' } } })
    await ctx.payload.create({
      collection: 'products', overrideAccess: false, user: { ...ctx.users.syncDemo, collection: 'users' } as unknown as TypedUser,
      data: { recordId: 'product:legacy', name: 'Legacy', released: false, tenant: docs[0].id } as never,
    })
    const r = await sync({ dryRun: true })
    expect(r.orphans.map((o) => o.recordId)).toEqual(['product:legacy'])
    expect(await recordIds('products', 'viewerDemo')).toContain('product:legacy')
  })

  it('a bad snapshot is refused whole: nothing is written', async () => {
    edit('channels/web/demo/pages/home.md', (s) => s.replace('claim:widget-speed-001', 'claim:widget-roadmap-001'))
    edit('products/widget/product.md', (s) => s.replace('name: Widget', 'name: Widget Two'))
    const r = await sync()
    expect(r.ok).toBe(false)
    expect(r.problems.join('\n')).toContain('not public')
    const [p] = (await visible('products', 'viewerDemo')).filter((x) => x.recordId === 'product:widget')
    expect(p.name).toBe('Widget')
    edit('channels/web/demo/pages/home.md', (s) => s.replace('claim:widget-roadmap-001', 'claim:widget-speed-001'))
    edit('products/widget/product.md', (s) => s.replace('name: Widget Two', 'name: Widget'))
  })

  it('a sync account cannot sync into another site', async () => {
    await expect(sync({ client: asSync('syncB') })).rejects.toThrow(/not found or not assigned/)
  })

  it('a failed write stops the run and files a failed receipt; re-running finishes the job', async () => {
    edit('products/widget/claims.json', (s) => s.replace('sorts incoming requests by urgency.', 'sorts every incoming request by urgency.'))
    edit('products/widget/product.md', (s) => s.replace('name: Widget', 'name: Widget Prime'))
    const real = asSync('syncDemo')
    let writes = 0
    const flaky: CmsClient = {
      ...real,
      tenantId: (s) => real.tenantId(s),
      existing: (c, t) => real.existing(c, t),
      lastRevision: (t) => real.lastRevision(t),
      createReceipt: (d) => real.createReceipt(d),
      create: (c, d, f) => real.create(c, d, f),
      update: async (c, id, d, f) => {
        writes += 1
        if (writes === 2) throw new Error('network dropped')
        return real.update(c, id, d, f)
      },
    }
    const failed = await sync({ client: flaky })
    expect(failed.ok).toBe(false)
    expect(failed.error).toContain('network dropped')
    const receipts = (await visible('sync-receipts', 'viewerDemo')) as Record<string, any>[]
    expect(receipts.find((x) => x.receiptId === failed.receiptId)?.status).toBe('failed')
    const again = await sync()
    expect(again.ok).toBe(true)
    expect(again.counts.update).toBe(1) // only the write that failed is left
  })

  it('receipts are write-once', async () => {
    const [receipt] = await visible('sync-receipts', 'viewerDemo')
    for (const who of ['syncDemo', 'admin', 'viewerDemo']) {
      await expect(
        ctx.payload.update({
          collection: 'sync-receipts', id: receipt.id, overrideAccess: false,
          user: { ...ctx.users[who], collection: 'users' } as unknown as TypedUser, data: { status: 'ok' } as never,
        }),
      ).rejects.toThrow()
    }
    expect(await visible('sync-receipts', 'readerDemo')).toEqual([])
  })
})

describe('bodies follow _ops', () => {
  it('removing a page body in _ops clears it in the site', async () => {
    const p = path.join(ops, 'marketing/records/channels/web/demo/pages/blog/hello-world.md')
    const original = readFileSync(p, 'utf8')
    writeFileSync(p, original.replace(/\n---\n[\s\S]*$/, '\n---\n'))
    const r = await sync()
    expect(r.ok).toBe(true)
    const [post] = (await visible('posts', 'viewerDemo')).filter((x) => x.recordId === 'post:hello-world') as Record<string, any>[]
    expect(post.body ?? null).toBeNull()
    writeFileSync(p, original)
    await sync()
    const [back] = (await visible('posts', 'viewerDemo')).filter((x) => x.recordId === 'post:hello-world') as Record<string, any>[]
    expect(JSON.stringify(back.body)).toContain('Why it matters')
  })
})
