/**
 * Shared test setup. Each test file gets a freshly migrated throwaway database with two sites
 * (tenants A and B), one account per role, and realistic records in both sites.
 *
 * It wipes the database's public schema, so it refuses anything that is not localhost and named
 * *_test, removes production-style env vars first, and checks the app connected to that database.
 *
 *   DATABASE_URL=postgres://…@localhost:…/ayra_test PAYLOAD_SECRET=… npm test
 */
import { createRequire } from 'node:module'
import { rmSync } from 'node:fs'
import path from 'node:path'
import type { CollectionSlug, Payload, TypedUser } from 'payload'

const require = createRequire(import.meta.url)
const pg = require('pg') as typeof import('pg')

const url = process.env.DATABASE_URL ?? ''
// The app prefers these over DATABASE_URL, and a Blob token would upload to real storage.
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

export type Doc = { id: number | string; tenant?: unknown; [key: string]: unknown }
export type Ctx = { payload: Payload; users: Record<string, Doc>; tenantA: number; tenantB: number }
export const ctx = {} as Ctx

export const CONTENT: CollectionSlug[] = [
  'posts', 'media', 'products', 'claims', 'atoms', 'site-settings', 'pages', 'whats-new', 'legal', 'decks', 'audiences', 'workflows',
]
/** Per-site collections no website key may read (gated, or written by the site and read by people). */
export const NOT_FOR_WEBSITES: CollectionSlug[] = ['trust-documents', 'consent-records']

export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
export const lexical = (text: string) => ({
  root: {
    type: 'root', direction: null, format: '', indent: 0, version: 1,
    children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text, version: 1 }] }],
  },
})
export const lexicalUpload = (mediaId: number | string) => ({
  root: {
    type: 'root', version: 1, direction: null, format: '', indent: 0,
    children: [{ type: 'upload', version: 3, relationTo: 'media', value: mediaId, fields: null, format: '' }],
  },
})

export const asUser = (who: string | null): { overrideAccess: false; user?: TypedUser } => ({
  overrideAccess: false,
  user: who ? ({ ...ctx.users[who], collection: 'users' } as unknown as TypedUser) : undefined,
})

/** What an account can see; a refused read counts as seeing nothing. */
export async function visible(collection: CollectionSlug, who: string | null): Promise<Doc[]> {
  try {
    const res = await ctx.payload.find({ collection, ...asUser(who), limit: 200, depth: 0 })
    return res.docs as unknown as Doc[]
  } catch {
    return []
  }
}
export const recordIds = async (collection: CollectionSlug, who: string) =>
  (await visible(collection, who)).map((d) => String(d.recordId)).sort()
export const tenantOf = (d: Doc) => (typeof d.tenant === 'object' && d.tenant ? (d.tenant as Doc).id : d.tenant)

export const claim = (tenant: number, id: string, visibility: string, status = 'active', extra: Record<string, unknown> = {}) => ({
  recordId: `claim:${id}`, text: `${id}`, quote: 'q', sha256: 'a'.repeat(64), visibility, status, regulated: false,
  source: { path: 'records/products/alpha/claims.json', lineOrSection: '1', pinnedDate: '2026-10-16' },
  approvedBy: 'marketing.head', approvedAt: '2026-10-16', tenant, ...extra,
})

export async function setup(): Promise<void> {
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

  const mk = async (name: string, role: string, tenantIds: number[]) =>
    ctx.payload.create({
      collection: 'users',
      data: {
        name, role, email: `${name}@example.test`, password: 'test-only-password',
        tenants: tenantIds.map((tenant) => ({ tenant })),
      } as never,
    }) as unknown as Promise<Doc>
  ctx.users = {
    admin: await mk('admin', 'admin', []),
    viewerA: await mk('viewerA', 'editor', [ctx.tenantA]),
    readerA: await mk('readerA', 'site-reader', [ctx.tenantA]),
    readerB: await mk('readerB', 'site-reader', [ctx.tenantB]),
    syncA: await mk('syncA', 'sync', [ctx.tenantA]),
    syncB: await mk('syncB', 'sync', [ctx.tenantB]),
  }

  // The same records in both sites, written the only allowed way: by each site's sync account.
  for (const [who, tenant, t] of [['syncA', ctx.tenantA, 'a'], ['syncB', ctx.tenantB, 'b']] as const) {
    const opts = asUser(who)
    const create = (collection: CollectionSlug, data: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
      ctx.payload.create({ collection, ...opts, data: { tenant, ...data } as never, ...extra })

    for (const status of ['approved', 'draft']) {
      await create(
        'media',
        { alt: `Image ${t} ${status}`, recordId: `asset:org${t}/screen/img-${status}@1`, kind: 'screen', status },
        { file: { data: PNG, mimetype: 'image/png', name: `img-${t}-${status}.png`, size: PNG.length } },
      )
    }
    await create('products', { recordId: 'product:alpha', name: `Alpha ${t}`, released: true })
    await create('products', { recordId: 'product:unreleased-module', name: `Unreleased ${t}`, released: false })
    for (const c of [
      claim(tenant, 'public-001', 'public'),
      claim(tenant, 'internal-001', 'internal'),
      claim(tenant, 'investor-001', 'investor-only'),
      claim(tenant, 'old-001', 'public', 'deprecated', { note: 'replaced' }),
    ]) {
      await create('claims', c)
    }
    await create('atoms', { recordId: 'atom:flow-001', kind: 'workflow', recipe: 'R9', visibility: 'public', status: 'active', claims: ['claim:public-001'], shape: { steps: [] } })
    await create('atoms', { recordId: 'atom:secret-flow-001', kind: 'workflow', visibility: 'investor-only', status: 'active', claims: ['claim:investor-001'], shape: {} })
    await create('site-settings', { recordId: `site:site${t}`, org: `org${t}`, status: 'draft', ui: { 'cta.primary': 'Book a demo' }, owners: { accountable: 'marketing.web' } })
    const approved = { by: 'marketing.head', at: '2026-10-20', version: '1' }
    await create('posts', { recordId: 'post:hello', slug: 'hello', title: `Published ${t}`, body: lexical(t), status: 'approved', visibility: 'public', approved, author: { name: 'Junaid Kalia' }, cites: ['claim:public-001'] })
    await create('posts', { recordId: 'post:draft', slug: 'draft', title: `Draft ${t}`, body: lexical(t), status: 'draft', visibility: 'public' })
    await create('pages', {
      recordId: `page:org${t}/products-alpha`, template: 'product', route: '/products/alpha', product: 'product:alpha',
      visibility: 'public', gate: 'none', status: 'approved', approved,
      blocks: [{ blockType: 'hero-statement', props: { cites: ['claim:public-001'], tile: `asset:org${t}/screen/img-approved@1` } }],
    })
    await create('whats-new', {
      recordId: `release:org${t}/2026-alpha-launch`, product: 'product:alpha', status: 'published', visibility: 'public',
      whatShipped: ['claim:public-001'], features: [{ name: 'Beta thing', state: 'beta' }], source: { type: 'manual', ref: 'internal-ref' },
    })
    await create('whats-new', { recordId: `release:org${t}/2026-internal-note`, status: 'approved', visibility: 'internal', whatShipped: ['claim:internal-001'] })
    await create('legal', { recordId: 'legal:privacy@1', type: 'privacy', version: '1', effectiveAt: '2026-10-01', status: 'published', bodyMarkdown: `Privacy ${t}.` })
    await create('legal', { recordId: 'legal:terms@1', type: 'terms', version: '1', status: 'draft', bodyMarkdown: `Terms draft ${t}.` })
    await create('decks', { recordId: 'deck:overview', title: `Overview ${t}`, gate: 'none', status: 'approved', coverAsset: `asset:org${t}/screen/img-approved@1` })
    await create('decks', { recordId: 'deck:investor-2026', title: `Investors ${t}`, gate: 'investor', status: 'approved' })
    await create('trust-documents', { recordId: 'trustdoc:soc2-report', title: `SOC 2 ${t}`, type: 'soc2-report', version: '1', status: 'approved' })
    await create('audiences', { recordId: 'audience:clinics', name: `Clinics ${t}`, visibility: 'public', status: 'active' })
    await create('audiences', { recordId: 'audience:internal-ops', name: `Ops ${t}`, visibility: 'internal', status: 'active' })
    await create('workflows', { recordId: 'workflow:triage', name: `Triage ${t}`, visibility: 'public', status: 'active' })
    await create('workflows', { recordId: 'workflow:old', name: `Old ${t}`, visibility: 'public', status: 'retired' })
  }
  for (const [who, tenant] of [['readerA', ctx.tenantA], ['readerB', ctx.tenantB]] as const) {
    await ctx.payload.create({
      collection: 'consent-records', ...asUser(who),
      data: { tenant, anonymousId: `anon-${who}-0123456789`, choices: { analytics: false, marketing: false }, policyVersion: 'cookie@1', region: 'us' } as never,
    })
  }
}

export async function teardown(): Promise<void> {
  // Locally (no Blob token) uploads land on disk; remove them.
  rmSync(path.resolve(process.cwd(), 'media'), { recursive: true, force: true })
  await ctx.payload?.destroy?.()
}
