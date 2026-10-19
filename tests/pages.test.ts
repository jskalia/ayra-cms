/** Pages, posts, atoms and What's New: what an approved public record may cite. */
import type { CollectionSlug } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { asUser, ctx, lexical, lexicalUpload, setup, teardown, visible } from './setup'

beforeAll(setup, 180_000)
afterAll(teardown)

const approved = { by: 'marketing.head', at: '2026-10-20', version: '1' }
const createAs = (who: string, collection: CollectionSlug, data: Record<string, unknown>) =>
  ctx.payload.create({ collection, ...asUser(who), data: data as never })

let n = 0
const page = (extra: Record<string, unknown> = {}) => {
  n += 1
  return {
    recordId: `page:orga/p-${n}`, route: `/p-${n}`, template: 'proof', visibility: 'public', gate: 'none',
    status: 'approved', approved, tenant: ctx.tenantA, blocks: [], ...extra,
  }
}
const withBlock = (blockType: string, props: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  page({ blocks: [{ blockType, props }], ...extra })

describe('an approved public page cites only public records of its own site', () => {
  it('accepts public, active, approved, released records', async () => {
    const ok = await createAs('syncA', 'pages', page({
      template: 'product', product: 'product:alpha',
      blocks: [
        { blockType: 'hero-statement', props: { cites: ['claim:public-001'], tile: 'asset:orga/screen/img-approved@1' } },
        { blockType: 'workflow-diagram', props: { diagram: { recipe: 'R9', atoms: 'atom:flow-001' } } },
      ],
    }))
    expect(ok.id).toBeDefined()
  })
  it.each([
    ['an internal claim', () => withBlock('proof-numbers', { stats: ['claim:internal-001'] })],
    ['an investor-only claim', () => withBlock('proof-numbers', { stats: ['claim:investor-001'] })],
    ['a deprecated claim', () => withBlock('proof-numbers', { stats: ['claim:old-001'] })],
    ['an investor-only atom', () => withBlock('workflow-diagram', { diagram: { atoms: 'atom:secret-flow-001' } })],
    ['a draft asset', () => withBlock('screens', { shots: [{ asset: 'asset:orga/screen/img-draft@1' }] })],
    ['an unreleased product', () => page({ template: 'product', product: 'product:unreleased-module' })],
    ['a record that does not exist here', () => withBlock('quote', { quote: 'claim:does-not-exist' })],
    ['a reference inside prose', () => withBlock('statement', { text: 'As shown in claim:internal-001.' })],
    ['a reference used as an object key', () => withBlock('faq', { items: { 'claim:internal-001': 'x' } })],
    ['an upper-case prefix', () => withBlock('quote', { quote: 'Claim:public-001' })],
    ['a reference in the body', () => page({ body: lexical('see claim:investor-001') })],
  ] as [string, () => Record<string, unknown>][])('refuses %s', async (_label, data) => {
    await expect(createAs('syncA', 'pages', data())).rejects.toThrow()
  })
  it('refuses an embedded draft image in the body, accepts an approved one', async () => {
    const [draft] = (await visible('media', 'syncA')).filter((m) => String(m.recordId).includes('draft'))
    const [ok] = (await visible('media', 'syncA')).filter((m) => String(m.recordId).includes('approved'))
    await expect(createAs('syncA', 'pages', page({ body: lexicalUpload(draft.id) }))).rejects.toThrow()
    expect((await createAs('syncA', 'pages', page({ body: lexicalUpload(ok.id) }))).id).toBeDefined()
  })
  it('an approved internal page may cite internal records; a draft may cite anything', async () => {
    expect((await createAs('syncA', 'pages', withBlock('proof-numbers', { stats: ['claim:internal-001'] }, { visibility: 'internal' }))).id).toBeDefined()
    expect((await createAs('syncA', 'pages', withBlock('quote', { quote: 'claim:not-yet' }, { status: 'draft' }))).id).toBeDefined()
  })
})

describe('page rules', () => {
  it('routes are /lowercase/segments and unique within a site', async () => {
    for (const route of ['no-slash', '//evil.com', '/Upper', '/trailing/']) {
      await expect(createAs('syncA', 'pages', page({ route }))).rejects.toThrow()
    }
    await expect(createAs('syncA', 'pages', page({ route: '/products/alpha' }))).rejects.toThrow()
    expect((await createAs('syncB', 'pages', page({ route: '/p-shared', recordId: 'page:orgb/shared', tenant: ctx.tenantB }))).id).toBeDefined()
  })
  it('gated pages are noindex; approved pages name their approver', async () => {
    await expect(createAs('syncA', 'pages', page({ gate: 'investor', template: 'portal' }))).rejects.toThrow()
    await expect(createAs('syncA', 'pages', page({ approved: {} }))).rejects.toThrow()
  })
  it('blocks: shell blocks refused, props required, blocks must be a list', async () => {
    await expect(createAs('syncA', 'pages', withBlock('site-header', {}))).rejects.toThrow()
    await expect(createAs('syncA', 'pages', page({ blocks: [{ blockType: 'statement' }] }))).rejects.toThrow()
    await expect(createAs('syncA', 'pages', page({ blocks: { blockType: 'statement', props: {} } }))).rejects.toThrow()
  })
})

describe('posts, atoms and What’s New follow the same citation rule', () => {
  const post = (extra: Record<string, unknown>) => {
    n += 1
    return { recordId: `post:p-${n}`, slug: `p-${n}`, title: 'T', status: 'approved', visibility: 'public', approved, author: { name: 'Junaid Kalia' }, tenant: ctx.tenantA, ...extra }
  }
  it('an approved public post may not cite an internal claim or embed a draft image', async () => {
    await expect(createAs('syncA', 'posts', post({ cites: ['claim:internal-001'] }))).rejects.toThrow()
    const [draft] = (await visible('media', 'syncA')).filter((m) => String(m.recordId).includes('draft'))
    await expect(createAs('syncA', 'posts', post({ body: lexicalUpload(draft.id) }))).rejects.toThrow()
  })
  it('an approved post names a real author, and its record id is post:<slug>', async () => {
    await expect(createAs('syncA', 'posts', post({ author: {} }))).rejects.toThrow()
    await expect(createAs('syncA', 'posts', { ...post({}), recordId: 'post:mismatch' })).rejects.toThrow()
  })
  it('a public, active atom may not rest on an internal claim', async () => {
    await expect(
      createAs('syncA', 'atoms', { recordId: 'atom:leaky-001', visibility: 'public', status: 'active', claims: ['claim:internal-001'], tenant: ctx.tenantA }),
    ).rejects.toThrow()
  })
  it('a public What’s New entry may not cite an internal claim', async () => {
    await expect(
      createAs('syncA', 'whats-new', { recordId: 'release:orga/2026-leaky', status: 'approved', visibility: 'public', whatShipped: ['claim:internal-001'], tenant: ctx.tenantA }),
    ).rejects.toThrow()
    await expect(
      createAs('syncA', 'whats-new', {
        recordId: 'release:orga/2026-leaky-regulated', status: 'published', visibility: 'public', whatShipped: ['claim:public-001'],
        regulated: [{ claim: 'claim:investor-001' }], tenant: ctx.tenantA,
      }),
    ).rejects.toThrow()
  })
})
