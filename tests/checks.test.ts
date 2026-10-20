/** Phase 9.6: the control room's health checks (one test per check). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Session } from '../src/frontend/access'
import { runChecks, type Issue } from '../src/frontend/checks'
import { asUser, ctx, setup, teardown, visible } from './setup'

beforeAll(setup, 180_000)
afterAll(teardown)

const viewer = (): Session => ({
  payload: ctx.payload,
  user: { ...ctx.users.viewerA, collection: 'users' } as unknown as Session['user'],
  isAdmin: false,
})
const siteA = () => ({ id: ctx.tenantA, slug: 'savelifeai', name: 'SaveLife.AI' })
const of = (issues: Issue[], check: Issue['check']) => issues.filter((i) => i.check === check)

describe('control room checks', () => {
  it('a healthy site that was never synced only says so', async () => {
    const issues = await runChecks(viewer(), siteA())
    expect(issues.map((i) => i.check)).toEqual(['not-synced'])
  })

  it('flags public records whose citation stopped being public after approval', async () => {
    const [claim] = (await visible('claims', 'syncA')).filter((c) => c.recordId === 'claim:public-001')
    await ctx.payload.update({ collection: 'claims', id: claim.id, ...asUser('syncA'), data: { visibility: 'internal' } as never })
    try {
      const flagged = of(await runChecks(viewer(), siteA()), 'public-cites')
      const texts = flagged.map((i) => i.text).join('\n')
      expect(texts).toContain('/products/alpha') // the page
      expect(texts).toContain('Published a') // the post
      expect(texts).toContain('atom:flow-001') // the atom
      expect(texts).toContain('release:orga/2026-alpha-launch') // What's New
      expect(flagged.every((i) => i.level === 'bad' && i.text.includes('no longer public'))).toBe(true)
    } finally {
      await ctx.payload.update({ collection: 'claims', id: claim.id, ...asUser('syncA'), data: { visibility: 'public' } as never })
    }
  })

  it('flags approved pages past their review date', async () => {
    await ctx.payload.create({
      collection: 'pages', ...asUser('syncA'),
      data: {
        recordId: 'page:orga/old', route: '/old', template: 'proof', visibility: 'internal', gate: 'none', status: 'approved',
        approved: { by: 'x', at: '2025-01-01' }, reviewBy: '2025-06-01', blocks: [], tenant: ctx.tenantA,
      } as never,
    })
    const late = of(await runChecks(viewer(), siteA(), '2026-10-21'), 'review-date')
    expect(late.map((i) => i.text)).toEqual(['/old was due for review on 2025-06-01'])
  })

  it('flags an approved record with no recorded approver (data changed outside the rules)', async () => {
    const [post] = (await visible('posts', 'syncA')).filter((p) => p.recordId === 'post:hello')
    await ctx.payload.db.updateOne({ collection: 'posts', id: post.id, data: { approved: { by: null, at: null } } })
    const missing = of(await runChecks(viewer(), siteA()), 'approval')
    expect(missing.map((i) => i.text)).toEqual(['Published a is approved but has no recorded approver'])
  })

  it('flags a failed last sync and records no longer in _ops', async () => {
    await ctx.payload.create({
      collection: 'sync-receipts', ...asUser('syncA'),
      data: {
        receiptId: 'r-test-1', revision: 1, status: 'failed', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
        actor: 'test', error: 'network dropped', items: [], orphans: [{ collection: 'claims', recordId: 'claim:gone-001' }], tenant: ctx.tenantA,
      } as never,
    })
    const issues = await runChecks(viewer(), siteA())
    expect(of(issues, 'sync-failed').map((i) => i.text)).toEqual(['The last sync (rev 1) failed: network dropped'])
    expect(of(issues, 'orphans').map((i) => i.text)).toEqual(['claim:gone-001 (claims) is in the site but no longer in _ops'])
    expect(of(issues, 'not-synced')).toEqual([])
  })

  it('a viewer of site A learns nothing about site B', async () => {
    const issues = await runChecks(viewer(), { id: ctx.tenantB, slug: 'junaidkalia', name: 'Junaid Kalia' })
    expect(issues.map((i) => i.check)).toEqual(['not-synced']) // B's records and receipts are invisible to this viewer
  })
})

