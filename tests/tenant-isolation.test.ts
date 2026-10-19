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
// The app prefers these over DATABASE_URL, and a Blob token would upload to real storage:
// remove them all so this test can only ever touch the throwaway database checked below.
for (const name of Object.keys(process.env)) {
  if (/^(DATABASE_URL_UNPOOLED|POSTGRES_|PG[A-Z]+$|BLOB_|DEPLOY_HOOK_|NEON_)/.test(name)) delete process.env[name]
}
const safe = (() => {
  try {
    const u = new URL(url)
    return ['localhost', '127.0.0.1'].includes(u.hostname) && /^\/[\w-]+_test$/.test(u.pathname)
  } catch {
    return false
  }
})()

type Doc = { id: number | string; tenant?: unknown; title?: string; email?: string; slug?: string }
type Ctx = { payload: Payload; users: Record<string, Doc>; tenantA: number; tenantB: number }
const ctx = {} as Ctx

const content: CollectionSlug[] = ['posts', 'categories', 'authors', 'media', 'products', 'claims', 'atoms', 'site-settings']
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
  const connected = (ctx.payload.db as unknown as { poolOptions?: { connectionString?: string } }).poolOptions?.connectionString
  if (connected !== url) throw new Error('Refusing to run: the app is not connected to the checked test database.')
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
    for (const status of ['approved', 'draft']) {
      await ctx.payload.create({
        collection: 'media', ...opts,
        data: { alt: `Image ${tag} ${status}`, recordId: `asset:org${tag}/screen/img-${status}@1`, kind: 'screen', status, tenant } as never,
        file: { data: PNG, mimetype: 'image/png', name: `img-${tag}-${status}.png`, size: PNG.length },
      })
    }
    await ctx.payload.create({ collection: 'products', ...opts, data: { recordId: 'product:alpha', name: `Alpha ${tag}`, released: true, tenant } as never })
    await ctx.payload.create({ collection: 'products', ...opts, data: { recordId: 'product:unreleased-module', name: `Unreleased ${tag}`, released: false, tenant } as never })
    const claim = (id: string, visibility: string, status = 'active', extra = {}) => ({
      recordId: `claim:${id}`, text: `${id} ${tag}`, quote: 'q', sha256: 'a'.repeat(64), visibility, status, regulated: false,
      source: { path: 'records/products/alpha/claims.json', lineOrSection: '1', pinnedDate: '2026-10-16' },
      approvedBy: 'marketing.head', approvedAt: '2026-10-16', tenant, ...extra,
    })
    for (const c of [claim('public-001', 'public'), claim('internal-001', 'internal'), claim('investor-001', 'investor-only'),
      claim('old-001', 'public', 'deprecated', { note: 'replaced' })]) {
      await ctx.payload.create({ collection: 'claims', ...opts, data: c as never })
    }
    for (const [id, visibility] of [['flow-001', 'public'], ['secret-flow-001', 'investor-only']]) {
      await ctx.payload.create({
        collection: 'atoms', ...opts,
        data: { recordId: `atom:${id}`, kind: 'workflow', recipe: 'R9', visibility, status: 'active', claims: ['claim:public-001'], shape: { steps: [] }, tenant } as never,
      })
    }
    await ctx.payload.create({
      collection: 'site-settings', ...opts,
      data: { recordId: `site:site${tag}`, org: `org${tag}`, status: 'draft', ui: { 'cta.primary': 'Book a demo' }, owners: { accountable: 'marketing.web' }, tenant } as never,
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

describe('review findings stay fixed', () => {
  it('a website key cannot read drafts or old versions through /versions (F1)', async () => {
    const attempt = ctx.payload.findVersions({ collection: 'posts', ...asUser('readerA'), limit: 100 })
    await expect(attempt).rejects.toThrow()
    const asViewer = await ctx.payload.findVersions({ collection: 'posts', ...asUser('viewerA'), limit: 100 })
    expect(asViewer.docs.length).toBeGreaterThan(0)
  })

  it('sync cannot link a post to another tenant’s image, category or author (F2)', async () => {
    const [mediaB] = await visible('media', 'readerB')
    const [catB] = await visible('categories', 'readerB')
    const [authorB] = await visible('authors', 'readerB')
    const base = { title: 'Linky', content: lexical('x'), tenant: ctx.tenantA }
    for (const [i, extra] of [
      { featuredImage: mediaB.id },
      { categories: [catB.id] },
      { authors: [authorB.id] },
    ].entries()) {
      await expect(
        ctx.payload.create({ collection: 'posts', ...asUser('syncA'), draft: true, data: { ...base, slug: `linky-${i}`, ...extra } as never }),
      ).rejects.toThrow()
    }
    const uploadNode = { root: { type: 'root', version: 1, direction: null, format: '', indent: 0,
      children: [{ type: 'upload', version: 3, relationTo: 'media', value: mediaB.id, fields: null, format: '' }] } }
    await expect(
      ctx.payload.create({ collection: 'posts', ...asUser('syncA'), draft: true, data: { ...base, slug: 'linky-rt', content: uploadNode } as never }),
    ).rejects.toThrow()
    const [mediaA] = await visible('media', 'readerA')
    const ok = await ctx.payload.create({
      collection: 'posts', ...asUser('syncA'), draft: true,
      data: { ...base, slug: 'linky-ok', featuredImage: mediaA.id } as never,
    })
    expect(ok.id).toBeDefined()
  })

  it('sync cannot create a draft with no tenant (F6)', async () => {
    await expect(
      ctx.payload.create({ collection: 'posts', ...asUser('syncA'), draft: true, data: { title: 'Orphan', slug: 'orphan', content: lexical('x') } as never }),
    ).rejects.toThrow()
  })

  it('website and sync accounts cannot sign in with a password (F7)', async () => {
    for (const who of ['readerA', 'syncA']) {
      await expect(
        ctx.payload.login({ collection: 'users', data: { email: `${who.toLowerCase()}@example.test`, password: 'test-only-password' } }),
      ).rejects.toThrow()
    }
    const ok = await ctx.payload.login({ collection: 'users', data: { email: 'viewera@example.test', password: 'test-only-password' } })
    expect(ok.user?.email).toBe('viewera@example.test')
  })

  it('only an admin manages API keys; API accounts cannot edit themselves (F7)', async () => {
    await expect(
      ctx.payload.update({ collection: 'users', id: ctx.users.viewerA.id, ...asUser('viewerA'), data: { enableAPIKey: true } as never }),
    ).rejects.toThrow()
    await expect(
      ctx.payload.update({ collection: 'users', id: ctx.users.readerA.id, ...asUser('readerA'), data: { name: 'renamed' } as never }),
    ).rejects.toThrow()
    const self = await ctx.payload.update({ collection: 'users', id: ctx.users.viewerA.id, ...asUser('viewerA'), data: { name: 'Viewer A' } as never })
    expect(self.name).toBe('Viewer A')
  })

  it('document locks are switched off (F4)', () => {
    expect(ctx.payload.collections['payload-locked-documents' as CollectionSlug]).toBeUndefined()
  })
})

describe('the same-tenant check covers every link field', () => {
  // If this fails, a link field was added: add it to that collection's sameTenantReferences
  // extractor (src/collections/*.ts), then update this list.
  const covered: Record<string, string[]> = {
    posts: ['tenant', 'featuredImage', 'categories', 'authors'],
    authors: ['tenant', 'photo'],
    categories: ['tenant'],
    media: ['tenant'],
    products: ['tenant'],
    claims: ['tenant'],
    atoms: ['tenant'],
    'site-settings': ['tenant'],
    pages: ['tenant'],
  }
  it.each(Object.keys(covered))('%s has no unchecked relationship or upload field', (slug) => {
    const fields = ctx.payload.collections[slug as CollectionSlug].config.flattenedFields
    const links = fields.filter((f) => f.type === 'relationship' || f.type === 'upload').map((f) => f.name)
    expect(links.sort()).toEqual([...covered[slug]].sort())
  })
})

describe('one-time admin bootstrap', () => {
  it('does nothing unless both variables are set', async () => {
    const { bootstrapAdmin } = await import('../src/lib/bootstrapAdmin')
    expect(await bootstrapAdmin(ctx.payload, {})).toBe('not-configured')
    expect(await bootstrapAdmin(ctx.payload, { email: 'boot@example.test' })).toBe('not-configured')
  })
  it('refuses a short password', async () => {
    const { bootstrapAdmin } = await import('../src/lib/bootstrapAdmin')
    expect(await bootstrapAdmin(ctx.payload, { email: 'boot@example.test', password: 'short' })).toBe('too-short')
  })
  it('creates one admin who can sign in, once', async () => {
    const { bootstrapAdmin } = await import('../src/lib/bootstrapAdmin')
    const creds = { email: 'Boot@Example.test', password: 'a-long-test-password' }
    expect(await bootstrapAdmin(ctx.payload, creds)).toBe('created')
    expect(await bootstrapAdmin(ctx.payload, creds)).toBe('exists')
    const login = await ctx.payload.login({ collection: 'users', data: { email: 'boot@example.test', password: creds.password } })
    expect(login.user?.role).toBe('admin')
  })
  it('never changes an existing account (no takeover)', async () => {
    const { bootstrapAdmin } = await import('../src/lib/bootstrapAdmin')
    expect(await bootstrapAdmin(ctx.payload, { email: 'viewera@example.test', password: 'attacker-password-123' })).toBe('exists')
    await expect(
      ctx.payload.login({ collection: 'users', data: { email: 'viewera@example.test', password: 'attacker-password-123' } }),
    ).rejects.toThrow()
    const me = await ctx.payload.find({ collection: 'users', where: { email: { equals: 'viewera@example.test' } } })
    expect(me.docs[0].role).toBe('editor')
  })
})

describe('the visibility firewall (what a website key may see)', () => {
  const ids = async (collection: CollectionSlug, who: string) =>
    (await visible(collection, who)).map((d) => (d as unknown as { recordId: string }).recordId).sort()

  it('products: released only (no unreleased module, MP-D29)', async () => {
    expect(await ids('products', 'readerA')).toEqual(['product:alpha'])
    expect(await ids('products', 'viewerA')).toEqual(['product:alpha', 'product:unreleased-module'])
  })
  it('claims: public and active only (G-SITE-7)', async () => {
    expect(await ids('claims', 'readerA')).toEqual(['claim:public-001'])
    expect((await ids('claims', 'viewerA')).length).toBe(4)
  })
  it('atoms: public and active only', async () => {
    expect(await ids('atoms', 'readerA')).toEqual(['atom:flow-001'])
  })
  it('assets: approved only', async () => {
    expect(await ids('media', 'readerA')).toEqual(['asset:orgA/screen/img-approved@1'])
  })
  it('site settings: one per site, internal parts hidden from the website', async () => {
    const [mine] = await visible('site-settings', 'readerA')
    const settings = mine as unknown as Record<string, unknown>
    expect(settings.ui).toEqual({ 'cta.primary': 'Book a demo' })
    expect(settings.owners).toBeUndefined()
    const [asViewer] = await visible('site-settings', 'viewerA')
    expect((asViewer as unknown as Record<string, unknown>).owners).toEqual({ accountable: 'marketing.web' })
    await expect(
      ctx.payload.create({ collection: 'site-settings', ...asUser('syncA'), data: { recordId: 'site:second', org: 'x', tenant: ctx.tenantA } as never }),
    ).rejects.toThrow()
  })
})

describe('record rules', () => {
  const base = (extra: Record<string, unknown>) => ({
    recordId: 'claim:rule-001', text: 't', quote: 'q', sha256: 'b'.repeat(64), visibility: 'public', status: 'active', regulated: false,
    source: { path: 'p', lineOrSection: '1', pinnedDate: '2026-10-16' }, approvedBy: 'x', approvedAt: '2026-10-16',
    tenant: ctx.tenantA, ...extra,
  })
  const create = (data: Record<string, unknown>) => ctx.payload.create({ collection: 'claims', ...asUser('syncA'), data: data as never })

  it('a record id is unique within a site, and may repeat across sites', async () => {
    await expect(create(base({ recordId: 'claim:public-001' }))).rejects.toThrow()
    expect(await ids2('claims', 'readerB')).toContain('claim:public-001')
  })
  it('a record id must carry its prefix', async () => {
    await expect(create(base({ recordId: 'public-002' }))).rejects.toThrow()
  })
  it('a K-number makes a claim regulated, with platform vs module', async () => {
    await expect(create(base({ recordId: 'claim:k-001', kNumber: 'K260936' }))).rejects.toThrow()
    await expect(create(base({ recordId: 'claim:k-002', kNumber: 'K26093' , regulated: true, platformVsModule: 'platform' }))).rejects.toThrow()
    const ok = await create(base({ recordId: 'claim:k-003', kNumber: 'K260936', regulated: true, platformVsModule: 'platform' }))
    expect(ok.id).toBeDefined()
  })
  it('a deprecated claim needs superseded_by or a note', async () => {
    await expect(create(base({ recordId: 'claim:dep-001', status: 'deprecated' }))).rejects.toThrow()
  })
  it('a promoted claim cannot be needs-owner', async () => {
    await expect(create(base({ recordId: 'claim:own-001', status: 'needs-owner' }))).rejects.toThrow()
  })
  it('sha256 must be a real sha256', async () => {
    await expect(create(base({ recordId: 'claim:sha-001', sha256: 'not-a-hash' }))).rejects.toThrow()
  })
})

async function ids2(collection: CollectionSlug, who: string) {
  return (await visible(collection, who)).map((d) => (d as unknown as { recordId: string }).recordId)
}

describe('pages', () => {
  const page = (extra: Record<string, unknown>) => ({
    template: 'product', route: '/products/alpha', product: 'product:alpha', visibility: 'public', gate: 'none',
    status: 'approved', approved: { by: 'marketing.head', at: '2026-10-20', version: '1' }, tenant: ctx.tenantA,
    blocks: [
      { blockType: 'hero-statement', props: { statement: 'One line', cites: ['claim:public-001'], tile: 'asset:orgA/screen/img-approved@1' } },
      { blockType: 'workflow-diagram', props: { diagram: { recipe: 'R9', atoms: 'atom:flow-001' } } },
    ],
    ...extra,
  })
  const create = (who: string, data: Record<string, unknown>) =>
    ctx.payload.create({ collection: 'pages', ...asUser(who), data: data as never })

  it('an approved public page citing public records is accepted', async () => {
    const ok = await create('syncA', page({ recordId: 'page:orgA/products-alpha' }))
    expect(ok.id).toBeDefined()
  })
  it('an approved public page cannot cite an internal or investor-only claim', async () => {
    for (const ref of ['claim:internal-001', 'claim:investor-001', 'claim:old-001']) {
      await expect(create('syncA', page({
        recordId: `page:orgA/bad-${ref.split(':')[1]}`, route: `/bad-${ref.split(':')[1]}`,
        blocks: [{ blockType: 'proof-numbers', props: { stats: [ref] } }],
      }))).rejects.toThrow()
    }
  })
  it('an approved public page cannot cite an investor-only atom, a draft asset or an unreleased product', async () => {
    const cases = [
      { blocks: [{ blockType: 'workflow-diagram', props: { diagram: { atoms: 'atom:secret-flow-001' } } }] },
      { blocks: [{ blockType: 'screens', props: { shots: [{ asset: 'asset:orgA/screen/img-draft@1' }] } }] },
      { product: 'product:unreleased-module', blocks: [] },
    ]
    for (const [i, c] of cases.entries()) {
      await expect(create('syncA', page({ recordId: `page:orgA/bad-${i}`, route: `/bad-x-${i}`, ...c }))).rejects.toThrow()
    }
  })
  it('a page cannot cite a record that does not exist in its own site', async () => {
    await expect(create('syncA', page({
      recordId: 'page:orgA/missing', route: '/missing', blocks: [{ blockType: 'quote', props: { quote: 'claim:does-not-exist' } }],
    }))).rejects.toThrow()
  })
  it('an approved internal page may cite internal records; a draft may cite anything', async () => {
    const internal = await create('syncA', page({
      recordId: 'page:orgA/internal', route: '/internal', visibility: 'internal', template: 'proof', product: undefined,
      blocks: [{ blockType: 'proof-numbers', props: { stats: ['claim:internal-001'] } }],
    }))
    expect(internal.id).toBeDefined()
    const draft = await create('syncA', page({
      recordId: 'page:orgA/draft', route: '/draft', status: 'draft', blocks: [{ blockType: 'quote', props: { quote: 'claim:not-yet' } }],
    }))
    expect(draft.id).toBeDefined()
  })
  it('routes and record ids are unique within a site, not across sites', async () => {
    await expect(create('syncA', page({ recordId: 'page:orgA/other' }))).rejects.toThrow()
    await expect(create('syncA', page({ route: '/elsewhere', recordId: 'page:orgA/products-alpha' }))).rejects.toThrow()
    const inB = await create('syncB', page({
      recordId: 'page:orgB/products-alpha', tenant: ctx.tenantB,
      blocks: [{ blockType: 'hero-statement', props: { cites: ['claim:public-001'], tile: 'asset:orgB/screen/img-approved@1' } }],
    }))
    expect(inB.id).toBeDefined()
  })
  it('page rules: gated pages are noindex; approved pages name their approver; shell blocks are not page blocks', async () => {
    await expect(create('syncA', page({ recordId: 'page:orgA/gated', route: '/gated', gate: 'investor', template: 'portal', product: undefined, blocks: [] }))).rejects.toThrow()
    await expect(create('syncA', page({ recordId: 'page:orgA/noappr', route: '/noappr', approved: {} }))).rejects.toThrow()
    await expect(create('syncA', page({ recordId: 'page:orgA/shell', route: '/shell', blocks: [{ blockType: 'site-header', props: {} }] }))).rejects.toThrow()
  })
  it('a website key sees approved public pages only', async () => {
    const routes = (await visible('pages', 'readerA')).map((p) => (p as unknown as { route: string }).route).sort()
    expect(routes).toEqual(['/products/alpha'])
    const all = (await visible('pages', 'viewerA')).map((p) => (p as unknown as { route: string }).route).sort()
    expect(all).toEqual(['/draft', '/internal', '/products/alpha'])
  })
})
