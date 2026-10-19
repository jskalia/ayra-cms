/** The visibility firewall: what a website key may see (G-SITE-7, MP-D29, P-3). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { asUser, ctx, recordIds, setup, teardown, visible } from './setup'

beforeAll(setup, 180_000)
afterAll(teardown)

describe('records a website key may see', () => {
  it('products: released only (no unreleased module)', async () => {
    expect(await recordIds('products', 'readerA')).toEqual(['product:alpha'])
    expect(await recordIds('products', 'viewerA')).toEqual(['product:alpha', 'product:unreleased-module'])
  })
  it('claims: public and active only', async () => {
    expect(await recordIds('claims', 'readerA')).toEqual(['claim:public-001'])
    expect((await recordIds('claims', 'viewerA')).length).toBe(4)
  })
  it('atoms: public and active only', async () => {
    expect(await recordIds('atoms', 'readerA')).toEqual(['atom:flow-001'])
  })
  it('assets: approved only', async () => {
    expect(await recordIds('media', 'readerA')).toEqual(['asset:orga/screen/img-approved@1'])
  })
  it('posts: approved and public only', async () => {
    expect(await recordIds('posts', 'readerA')).toEqual(['post:hello'])
  })
  it('pages: approved, public and ungated only', async () => {
    await ctx.payload.create({
      collection: 'pages', ...asUser('syncA'),
      data: {
        recordId: 'page:orga/investors', template: 'portal', route: '/investorportal', visibility: 'public', gate: 'investor',
        status: 'approved', approved: { by: 'x', at: '2026-10-20' }, seo: { noindex: true }, blocks: [], tenant: ctx.tenantA,
      } as never,
    })
    expect(await recordIds('pages', 'readerA')).toEqual(['page:orga/products-alpha'])
    expect(await recordIds('pages', 'viewerA')).toEqual(['page:orga/investors', 'page:orga/products-alpha'])
  })
  it('what’s new: approved or published, and public only', async () => {
    expect(await recordIds('whats-new', 'readerA')).toEqual(['release:orga/2026-alpha-launch'])
  })
})

describe('internal fields are hidden from website keys', () => {
  const one = async (collection: Parameters<typeof visible>[0], who: string) =>
    (await visible(collection, who))[0] as Record<string, unknown>

  it('site settings: owners, approvers and redesign hidden; one per site', async () => {
    const mine = await one('site-settings', 'readerA')
    expect(mine.ui).toEqual({ 'cta.primary': 'Book a demo' })
    expect(mine.owners).toBeUndefined()
    expect((await one('site-settings', 'viewerA')).owners).toEqual({ accountable: 'marketing.web' })
    await expect(
      ctx.payload.create({ collection: 'site-settings', ...asUser('syncA'), data: { recordId: 'site:second', org: 'x', tenant: ctx.tenantA } as never }),
    ).rejects.toThrow()
  })
  it('claims: source, approval, notes and sync data hidden', async () => {
    const c = await one('claims', 'readerA')
    for (const field of ['source', 'approvedBy', 'approvedAt', 'note', 'visibilityNote', 'sync']) expect(c[field]).toBeUndefined()
    expect(c.text).toBeDefined()
    const asViewer = await one('claims', 'viewerA')
    expect(asViewer.source).toBeDefined()
  })
  it('what’s new: feature list (beta/internal), source and other internal parts hidden', async () => {
    const r = await one('whats-new', 'readerA')
    for (const field of ['source', 'withheld', 'channels', 'approvals', 'receipts', 'siteRelease', 'sync']) expect(r[field]).toBeUndefined()
    // Payload returns a hidden list field as an empty list: no rows reach the website.
    expect(r.features ?? []).toEqual([])
    expect(r.whatShipped).toEqual(['claim:public-001'])
  })
  it('a hidden field cannot be used to filter (no inference)', async () => {
    await expect(
      ctx.payload.find({ collection: 'site-settings', ...asUser('readerA'), where: { 'owners.accountable': { equals: 'marketing.web' } } }),
    ).rejects.toThrow()
  })
})
