/** Tenant isolation (WebsiteOps plan W5.2: "two tenants isolated (tests); no cross-tenant read"). */
import type { CollectionSlug } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CONTENT, asUser, ctx, lexical, lexicalUpload, setup, teardown, tenantOf, visible } from './setup'

beforeAll(setup, 180_000)
afterAll(teardown)

describe('anonymous requests', () => {
  it.each(CONTENT)('cannot read %s', async (collection) => {
    expect(await visible(collection, null)).toEqual([])
  })
  it('cannot read users or tenants', async () => {
    expect(await visible('users', null)).toEqual([])
    expect(await visible('tenants', null)).toEqual([])
  })
})

describe('a website key (site-reader) sees only its own site', () => {
  it.each(CONTENT)('%s: only site A, never site B', async (collection) => {
    const docs = await visible(collection, 'readerA')
    expect(docs.length).toBeGreaterThan(0)
    expect(docs.every((d) => tenantOf(d) === ctx.tenantA)).toBe(true)
  })
  it('cannot open a site B post by id', async () => {
    const [b] = await visible('posts', 'readerB')
    await expect(ctx.payload.findByID({ collection: 'posts', id: b.id, ...asUser('readerA') })).rejects.toThrow()
  })
  it('sees only its own account and its own tenant record', async () => {
    expect((await visible('users', 'readerA')).map((u) => u.email)).toEqual(['readera@example.test'])
    expect((await visible('tenants', 'readerA')).map((t) => t.id)).toEqual([ctx.tenantA])
  })
  it('cannot write', async () => {
    await expect(
      ctx.payload.create({ collection: 'products', ...asUser('readerA'), data: { recordId: 'product:x', name: 'x', tenant: ctx.tenantA } as never }),
    ).rejects.toThrow()
  })
})

describe('people cannot edit content (the admin is read-only for content)', () => {
  it('a viewer sees its site’s drafts and approved posts, nothing from B', async () => {
    const titles = (await visible('posts', 'viewerA')).map((d) => d.title).sort()
    expect(titles).toEqual(['Draft a', 'Published a'])
  })
  it.each(['viewerA', 'admin'])('%s cannot create, update or delete content', async (who) => {
    const [post] = await visible('posts', 'syncA')
    await expect(ctx.payload.create({ collection: 'products', ...asUser(who), data: { recordId: 'product:y', name: 'y', tenant: ctx.tenantA } as never })).rejects.toThrow()
    await expect(ctx.payload.update({ collection: 'posts', id: post.id, ...asUser(who), data: { title: 'changed' } as never })).rejects.toThrow()
    await expect(ctx.payload.delete({ collection: 'posts', id: post.id, ...asUser(who) })).rejects.toThrow()
  })
  it('an admin can see every site', async () => {
    expect(new Set((await visible('posts', 'admin')).map(tenantOf))).toEqual(new Set([ctx.tenantA, ctx.tenantB]))
  })
})

describe('the sync account writes only into its own site', () => {
  it('cannot create content in another site', async () => {
    await expect(
      ctx.payload.create({ collection: 'products', ...asUser('syncA'), data: { recordId: 'product:sneaky', name: 'Sneaky', tenant: ctx.tenantB } as never }),
    ).rejects.toThrow()
    expect((await visible('products', 'admin')).map((p) => p.recordId)).not.toContain('product:sneaky')
  })
  it('cannot update or delete another site’s content', async () => {
    const [b] = await visible('posts', 'readerB')
    await expect(ctx.payload.update({ collection: 'posts', id: b.id, ...asUser('syncA'), data: { title: 'hijacked' } as never })).rejects.toThrow()
    await expect(ctx.payload.delete({ collection: 'posts', id: b.id, ...asUser('syncA') })).rejects.toThrow()
    expect((await ctx.payload.findByID({ collection: 'posts', id: b.id })).title).toBe('Published b')
  })
  it('cannot create a record with no site', async () => {
    await expect(
      ctx.payload.create({ collection: 'posts', ...asUser('syncA'), data: { recordId: 'post:orphan', slug: 'orphan', title: 'Orphan', status: 'draft' } as never }),
    ).rejects.toThrow()
  })
  it('cannot embed another site’s image in rich text', async () => {
    const [mediaB] = await visible('media', 'readerB')
    const [mediaA] = await visible('media', 'readerA')
    const base = { title: 'Linky', status: 'draft', visibility: 'public', tenant: ctx.tenantA }
    await expect(
      ctx.payload.create({ collection: 'posts', ...asUser('syncA'), data: { ...base, recordId: 'post:linky-b', slug: 'linky-b', body: lexicalUpload(mediaB.id) } as never }),
    ).rejects.toThrow()
    const ok = await ctx.payload.create({ collection: 'posts', ...asUser('syncA'), data: { ...base, recordId: 'post:linky-a', slug: 'linky-a', body: lexicalUpload(mediaA.id) } as never })
    expect(ok.id).toBeDefined()
  })
  it('a record’s id and site never change after it is created', async () => {
    const [p] = (await visible('products', 'syncA')).filter((d) => d.recordId === 'product:alpha')
    await expect(ctx.payload.update({ collection: 'products', id: p.id, ...asUser('syncA'), data: { recordId: 'product:renamed' } as never })).rejects.toThrow()
    await expect(ctx.payload.update({ collection: 'products', id: p.id, ...asUser('syncA'), data: { tenant: ctx.tenantB } as never })).rejects.toThrow()
    const same = await ctx.payload.update({ collection: 'products', id: p.id, ...asUser('syncA'), data: { name: 'Alpha a' } as never })
    expect(same.recordId).toBe('product:alpha')
  })
  it('the same slug may exist in two sites, but not twice in one', async () => {
    expect((await visible('posts', 'readerB')).map((p) => p.slug)).toContain('hello')
    await expect(
      ctx.payload.create({ collection: 'posts', ...asUser('syncA'), data: { recordId: 'post:hello', slug: 'hello', title: 'Dup', status: 'draft', visibility: 'public', tenant: ctx.tenantA } as never }),
    ).rejects.toThrow()
  })
})

describe('structure guards', () => {
  // If this fails, a link field was added: cover it in that collection's sameTenantReferences
  // extractor, then update this list.
  const covered: Record<string, string[]> = Object.fromEntries(CONTENT.map((c) => [c, ['tenant']]))
  it.each(Object.keys(covered))('%s has no unchecked relationship or upload field', (slug) => {
    const fields = ctx.payload.collections[slug as CollectionSlug].config.flattenedFields
    const links = fields.filter((f) => f.type === 'relationship' || f.type === 'upload').map((f) => f.name)
    expect(links.sort()).toEqual([...covered[slug]].sort())
  })
  it('document locks are switched off', () => {
    expect(ctx.payload.collections['payload-locked-documents' as CollectionSlug]).toBeUndefined()
  })
  it('the rich-text helper is used by posts (sanity)', async () => {
    const post = await ctx.payload.create({
      collection: 'posts', ...asUser('syncA'),
      data: { recordId: 'post:plain', slug: 'plain', title: 'Plain', body: lexical('plain'), status: 'draft', visibility: 'internal', tenant: ctx.tenantA } as never,
    })
    expect(post.id).toBeDefined()
  })
})
