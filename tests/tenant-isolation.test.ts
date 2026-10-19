/**
 * Tenant isolation (WebsiteOps plan W5.2, "done when: two tenants isolated (tests); no
 * cross-tenant read"). Runs against a throwaway local database: it wipes the database's
 * public schema, so it refuses anything that is not localhost and named *_test.
 *
 *   DATABASE_URL=postgres://…@localhost:…/ayra_test PAYLOAD_SECRET=… npm test
 */
import { createRequire } from 'node:module'
import { rmSync } from 'node:fs'
import path from 'node:path'
import type { CollectionSlug, Payload, TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const pg = require('pg') as typeof import('pg')

const url = process.env.DATABASE_URL ?? ''
const safe = /@(localhost|127\.0\.0\.1)(:\d+)?\/[\w-]+_test(\?|$)/.test(url)

type Doc = { id: number | string; tenant?: unknown; title?: string; email?: string; slug?: string }
type Ctx = { payload: Payload; users: Record<string, Doc>; tenantA: number; tenantB: number }
const ctx = {} as Ctx

const content: CollectionSlug[] = ['posts', 'categories', 'authors', 'media']
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const lexical = (text: string) => ({
  root: {
    type: 'root', direction: null, format: '', indent: 0, version: 1,
    children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text, version: 1 }] }],
  },
})

const asUser = (who: string | null): { overrideAccess: false; user?: TypedUser } => ({
  overrideAccess: false,
  user: who ? ({ ...ctx.users[who], collection: 'users' } as unknown as TypedUser) : undefined,
})

/** What a given account can see; a refused read counts as seeing nothing. */
async function visible(collection: CollectionSlug, who: string | null, draft = false): Promise<Doc[]> {
  try {
    const res = await ctx.payload.find({ collection, ...asUser(who), limit: 100, depth: 0, draft })
    return res.docs as Doc[]
  } catch {
    return []
  }
}

const tenantOf = (d: Doc) => (typeof d.tenant === 'object' && d.tenant ? (d.tenant as Doc).id : d.tenant)

beforeAll(async () => {
  if (!safe) throw new Error('Refusing to run: DATABASE_URL must be a localhost database named *_test.')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await client.end()

  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')
  const { migrations } = await import('../src/migrations')
  ctx.payload = await getPayload({ config, disableOnInit: true })
  await ctx.payload.db.migrate({ migrations: migrations as never })

  const tenants = await ctx.payload.find({ collection: 'tenants', limit: 10 })
  const bySlug = Object.fromEntries(tenants.docs.map((t) => [t.slug, t.id as number]))
  ctx.tenantA = bySlug.savelifeai
  ctx.tenantB = bySlug.junaidkalia

  const mk = async (name: string, role: string, tenants: number[]) =>
    ctx.payload.create({
      collection: 'users',
      data: {
        name, role, email: `${name}@example.test`, password: 'test-only-password',
        tenants: tenants.map((tenant) => ({ tenant })),
      } as never,
    }) as Promise<Doc>
  ctx.users = {
    admin: await mk('admin', 'admin', []),
    viewerA: await mk('viewerA', 'editor', [ctx.tenantA]),
    readerA: await mk('readerA', 'site-reader', [ctx.tenantA]),
    readerB: await mk('readerB', 'site-reader', [ctx.tenantB]),
    syncA: await mk('syncA', 'sync', [ctx.tenantA]),
    syncB: await mk('syncB', 'sync', [ctx.tenantB]),
  }

  // Content in both tenants, written the only allowed way: by each tenant's sync account.
  for (const [who, tenant, tag] of [['syncA', ctx.tenantA, 'A'], ['syncB', ctx.tenantB, 'B']] as const) {
    const opts = asUser(who)
    await ctx.payload.create({ collection: 'categories', ...opts, data: { title: `Cat ${tag}`, slug: 'news', tenant } as never })
    await ctx.payload.create({ collection: 'authors', ...opts, data: { name: `Author ${tag}`, tenant } as never })
    await ctx.payload.create({
      collection: 'media', ...opts, data: { alt: `Image ${tag}`, tenant } as never,
      file: { data: PNG, mimetype: 'image/png', name: `img-${tag}.png`, size: PNG.length },
    })
    await ctx.payload.create({
      collection: 'posts', ...opts,
      data: { title: `Published ${tag}`, slug: 'hello', content: lexical(tag), tenant, _status: 'published' } as never,
    })
    await ctx.payload.create({
      collection: 'posts', ...opts, draft: true,
      data: { title: `Draft ${tag}`, slug: 'draft', content: lexical(tag), tenant, _status: 'draft' } as never,
    })
  }
}, 180_000)

afterAll(async () => {
  // Locally (no Blob token) uploads land on disk; remove them.
  rmSync(path.resolve(process.cwd(), 'media'), { recursive: true, force: true })
  await ctx.payload?.destroy?.()
})

describe('anonymous requests', () => {
  it.each(content)('cannot read %s', async (collection) => {
    expect(await visible(collection, null)).toEqual([])
  })
  it('cannot read users or tenants', async () => {
    expect(await visible('users', null)).toEqual([])
    expect(await visible('tenants', null)).toEqual([])
  })
})

describe('a website key (site-reader) sees only its own tenant', () => {
  it.each(content)('%s: only tenant A, never tenant B', async (collection) => {
    const docs = await visible(collection, 'readerA')
    expect(docs.length).toBeGreaterThan(0)
    expect(docs.every((d) => tenantOf(d) === ctx.tenantA)).toBe(true)
  })
  it('sees published posts only, not drafts', async () => {
    const titles = (await visible('posts', 'readerA', true)).map((d) => d.title)
    expect(titles).toEqual(['Published A'])
  })
  it('cannot open a tenant B post by id', async () => {
    const [b] = await visible('posts', 'readerB')
    await expect(ctx.payload.findByID({ collection: 'posts', id: b.id, ...asUser('readerA') })).rejects.toThrow()
  })
  it('sees only its own account and its own tenant record', async () => {
    expect((await visible('users', 'readerA')).map((u) => u.email)).toEqual(['readera@example.test'])
    expect((await visible('tenants', 'readerA')).map((t) => t.id)).toEqual([ctx.tenantA])
  })
  it('cannot write', async () => {
    await expect(
      ctx.payload.create({ collection: 'categories', ...asUser('readerA'), data: { title: 'x', slug: 'x', tenant: ctx.tenantA } as never }),
    ).rejects.toThrow()
  })
})

describe('people cannot edit content (admin is read-only for content)', () => {
  it('a viewer sees tenant A drafts and published, nothing from B', async () => {
    const docs = await visible('posts', 'viewerA', true)
    expect(docs.map((d) => d.title).sort()).toEqual(['Draft A', 'Published A'])
  })
  it.each(['viewerA', 'admin'])('%s cannot create, update or delete content', async (who) => {
    const [post] = await visible('posts', 'syncA')
    await expect(ctx.payload.create({ collection: 'categories', ...asUser(who), data: { title: 'x', slug: 'y', tenant: ctx.tenantA } as never })).rejects.toThrow()
    await expect(ctx.payload.update({ collection: 'posts', id: post.id, ...asUser(who), data: { title: 'changed' } as never })).rejects.toThrow()
    await expect(ctx.payload.delete({ collection: 'posts', id: post.id, ...asUser(who) })).rejects.toThrow()
  })
  it('an admin can see every tenant', async () => {
    const tenants = new Set((await visible('posts', 'admin')).map(tenantOf))
    expect(tenants).toEqual(new Set([ctx.tenantA, ctx.tenantB]))
  })
  it('a viewer cannot promote themselves or add tenants', async () => {
    await ctx.payload.update({
      collection: 'users', id: ctx.users.viewerA.id, ...asUser('viewerA'),
      data: { role: 'admin', tenants: [{ tenant: ctx.tenantA }, { tenant: ctx.tenantB }] } as never,
    }).catch(() => undefined)
    const me = await ctx.payload.findByID({ collection: 'users', id: ctx.users.viewerA.id, depth: 0 })
    expect(me.role).toBe('editor')
    expect((me.tenants ?? []).map((t) => (typeof t.tenant === 'object' ? t.tenant.id : t.tenant))).toEqual([ctx.tenantA])
  })
})

describe('the sync account writes only into its own tenant', () => {
  it('cannot create content in another tenant', async () => {
    await expect(
      ctx.payload.create({ collection: 'categories', ...asUser('syncA'), data: { title: 'Sneaky', slug: 'sneaky', tenant: ctx.tenantB } as never }),
    ).rejects.toThrow()
    const everywhere = await visible('categories', 'admin')
    expect(everywhere.map((c) => c.slug)).not.toContain('sneaky')
  })
  it('cannot update or delete another tenant’s content', async () => {
    const [b] = await visible('posts', 'readerB')
    await expect(ctx.payload.update({ collection: 'posts', id: b.id, ...asUser('syncA'), data: { title: 'hijacked' } as never })).rejects.toThrow()
    await expect(ctx.payload.delete({ collection: 'posts', id: b.id, ...asUser('syncA') })).rejects.toThrow()
    const after = await ctx.payload.findByID({ collection: 'posts', id: b.id })
    expect(after.title).toBe('Published B')
  })
  it('the same slug may exist in two tenants, but not twice in one', async () => {
    expect((await visible('posts', 'readerA')).map((p) => p.slug)).toContain('hello')
    expect((await visible('posts', 'readerB')).map((p) => p.slug)).toContain('hello')
    await expect(
      ctx.payload.create({ collection: 'categories', ...asUser('syncA'), data: { title: 'Dup', slug: 'news', tenant: ctx.tenantA } as never }),
    ).rejects.toThrow()
  })
})
