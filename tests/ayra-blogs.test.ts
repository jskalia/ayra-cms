/**
 * AyraAgent Blogs → posts: published blogs become approved public posts written by the site's
 * sync account; archived ones retire; the public body carries no internal sources.
 * The AyraAgent API is faked here (its shape is the one the dev server returns).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { blogsApi, cleanBody, mapBlog, postSlug, runBlogImport, type AyraBlog, type BlogsApi } from '../src/sync/blogs'
import { ctx, setup, teardown, visible } from './setup'

beforeAll(setup, 180_000)
afterAll(teardown)

const BODY = [
  '# Widget: what changed this quarter',
  '',
  '## What is new',
  '',
  'Widget now sorts requests by urgency[^1]. Teams answer faster[^2].',
  '',
  '![Overview diagram](ayra-image:s1)',
  '',
  '```mermaid',
  'flowchart LR',
  '  A --> B',
  '```',
  '',
  '## Sources',
  '',
  '[^1]: **design-notes.md** — _projects/widget/_reviews/x · "internal excerpt"',
  '[^2]: **launch-plan.md** — marketing/work/widget · "draft excerpt"',
].join('\n')

const blog = (id: string, extra: Partial<AyraBlog> = {}): AyraBlog => ({
  id, org_id: 'demo-org', title: `Widget update ${id}`, slug: `widget-update-${id}`, status: 'published', summary: 'What changed in Widget.',
  revision: 1, published_at: '2026-10-21T10:00:00Z', body_markdown: BODY,
  sources: [{ n: 1, file_name: 'design-notes.md', source_path: '_projects/widget/_reviews/x', sha256: 'a'.repeat(64), excerpt: 'internal excerpt' }],
  seo: { slug: `widget-update-${id}`, meta_description: 'What changed in Widget.', keywords: ['widget'] },
  settings: { keywords: ['widget', 'urgency'] },
  ...extra,
})

/** A fake AyraAgent org: blogs by id, edited by the tests. */
const store = new Map<string, AyraBlog>()
const fakeApi = (): BlogsApi => ({
  list: async () => [...store.values()].map(({ body_markdown: _b, sources: _s, ...summary }) => summary as AyraBlog),
  get: async (id) => {
    const b = store.get(id)
    if (!b) throw new Error('not found')
    return b
  },
})
const hooks: string[] = []
const fakeFetch = (async (url: string | URL | Request) => {
  hooks.push(String(url))
  return new Response('{}', { status: 201 })
}) as typeof fetch
const env = { BLOGS_TOKEN_A: 'test-token', DEPLOY_HOOK_A: 'https://hooks.example.test/a' }
const run = (extra: Partial<Parameters<typeof runBlogImport>[0]> = {}) =>
  runBlogImport({ payload: ctx.payload, env, api: fakeApi, fetch: fakeFetch, site: 'savelifeai', ...extra })
const post = async (who: string, recordId: string) => (await visible('posts', who)).find((d) => d.recordId === recordId)

beforeAll(async () => {
  await ctx.payload.update({
    collection: 'tenants', id: ctx.tenantA, overrideAccess: true,
    data: { deployHookEnv: 'DEPLOY_HOOK_A', ayraBlogs: { org: 'demo-org', tokenEnv: 'BLOGS_TOKEN_A', author: { name: 'Sam Example', jobTitle: 'Physician' } } } as never,
  })
})

describe('preparing a blog for the public site', () => {
  it('removes the internal Sources list, the [^n] markers, placeholder images and the repeated title', () => {
    const out = cleanBody(BODY)
    expect(out).not.toMatch(/Sources|\[\^|design-notes|_projects|ayra-image|^# Widget/m)
    expect(out).toContain('Widget now sorts requests by urgency.')
    expect(out).toContain('```mermaid') // charts stay; the site draws them
  })
  it('makes slugs the CMS accepts', () => {
    expect(postSlug('VesselViz3D: How It Works — 2!')).toBe('vesselviz3d-how-it-works-2')
  })
  it('maps a blog to an approved public post with internal sources and short SEO fields', () => {
    const p = mapBlog(blog('x', { title: 'T'.repeat(80) }), { name: 'Sam Example' }, 'demo-org')
    expect(p).toMatchObject({ recordId: 'post:widget-update-x', status: 'approved', visibility: 'public', origin: 'ayra-blogs', externalId: 'x' })
    expect((p.seo as { title: string }).title.length).toBeLessThanOrEqual(60)
    expect((p.sources as { file: string }[])[0].file).toBe('design-notes.md')
    expect((p.approved as { at: string }).at).toBe('2026-10-21')
  })
})

describe('importing into a site', () => {
  it('a published blog becomes an approved post the website sees, without its internal sources', async () => {
    store.set('b1', blog('b1'))
    store.set('d1', blog('d1', { status: 'draft' })) // drafts are never imported
    const [r] = await run()
    expect(r.problems).toEqual([])
    expect(r.counts).toMatchObject({ create: 1, update: 0, retire: 0 })
    expect(r.receiptId).toBeTruthy()
    expect(r.deployHook).toBe('called')
    const site = await post('readerA', 'post:widget-update-b1')
    expect(site).toBeDefined()
    expect(site!.bodyMarkdown).not.toMatch(/Sources|_projects|\[\^/)
    expect(site!.body).toBeTruthy()
    for (const hidden of ['sources', 'externalId', 'sync']) expect(site![hidden]).toBeUndefined()
    expect(await post('readerA', 'post:widget-update-d1')).toBeUndefined()
    // People of the site see where it came from.
    const internal = await post('viewerA', 'post:widget-update-b1')
    expect(internal!.origin).toBe('ayra-blogs')
    expect((internal!.sources as unknown[]).length).toBe(1)
  })
  it('running again changes nothing, files no receipt and starts no rebuild', async () => {
    hooks.length = 0
    const [r] = await run()
    expect(r.counts).toMatchObject({ create: 0, update: 0, unchanged: 1, retire: 0 })
    expect(r.receiptId).toBeUndefined()
    expect(hooks).toEqual([])
  })
  it('an edited blog updates its post; a renamed slug keeps the post’s record id', async () => {
    store.set('b1', blog('b1', { revision: 2, title: 'Widget update, revised', slug: 'a-new-slug' }))
    const [r] = await run()
    expect(r.counts.update).toBe(1)
    const p = await post('readerA', 'post:widget-update-b1')
    expect(p!.title).toBe('Widget update, revised')
    expect(await post('readerA', 'post:a-new-slug')).toBeUndefined()
  })
  it('an archived blog retires its post: gone from the website, never deleted', async () => {
    store.set('b1', { ...store.get('b1')!, status: 'archived' })
    const [r] = await run()
    expect(r.counts.retire).toBe(1)
    expect(await post('readerA', 'post:widget-update-b1')).toBeUndefined()
    expect((await post('viewerA', 'post:widget-update-b1'))!.status).toBe('retired')
  })
  it('publishing it again brings it back', async () => {
    store.set('b1', { ...store.get('b1')!, status: 'published' })
    const [r] = await run()
    expect(r.counts.update).toBe(1)
    expect(await post('readerA', 'post:widget-update-b1')).toBeDefined()
  })
  it('a dry run writes nothing', async () => {
    store.set('b2', blog('b2'))
    const [r] = await run({ dryRun: true })
    expect(r.items.map((i) => `${i.recordId} ${i.action}`)).toContain('post:widget-update-b2 create')
    expect(await post('viewerA', 'post:widget-update-b2')).toBeUndefined()
    store.delete('b2')
  })
  it('one bad blog is refused on its own; the rest still import', async () => {
    store.set('bad', blog('bad', { body_markdown: 'Meet the Ayra Platform today.' }))
    store.set('good', blog('good'))
    const [r] = await run()
    expect(r.ok).toBe(false)
    expect(r.problems.join('\n')).toMatch(/widget-update-bad/)
    expect(await post('readerA', 'post:widget-update-good')).toBeDefined()
    expect(await post('viewerA', 'post:widget-update-bad')).toBeUndefined()
    store.delete('bad')
  })
  it('never takes over a post that came from _ops with the same slug', async () => {
    store.set('clash', blog('clash', { slug: 'hello', title: 'Hello again' }))
    const [r] = await run()
    expect(r.problems.join('\n')).toMatch(/already used by another post/)
    expect((await post('viewerA', 'post:hello'))!.title).toBe('Published a')
    store.delete('clash')
  })
  it('only touches its own site', async () => {
    expect((await visible('posts', 'readerB')).some((d) => String(d.recordId).startsWith('post:widget-update'))).toBe(false)
  })
})

describe('refusing unsafe setups', () => {
  it('no token: nothing is read', async () => {
    const [r] = await run({ env: {} })
    expect(r.problems[0]).toMatch(/no AyraAgent token/)
  })
  it('no author: nothing new is published', async () => {
    await ctx.payload.update({ collection: 'tenants', id: ctx.tenantA, overrideAccess: true, data: { ayraBlogs: { org: 'demo-org', tokenEnv: 'BLOGS_TOKEN_A', author: { name: '' } } } as never })
    store.set('noauthor', blog('noauthor'))
    const [r] = await run()
    expect(r.problems.join('\n')).toMatch(/no author/)
    expect(await post('viewerA', 'post:widget-update-noauthor')).toBeUndefined()
    store.delete('noauthor')
    await ctx.payload.update({ collection: 'tenants', id: ctx.tenantA, overrideAccess: true, data: { ayraBlogs: { org: 'demo-org', tokenEnv: 'BLOGS_TOKEN_A', author: { name: 'Sam Example', jobTitle: 'Physician' } } } as never })
  })
  it('no sync account for the site: nothing is written', async () => {
    const { docs } = await ctx.payload.find({ collection: 'tenants', where: { slug: { equals: 'signalandsymptoms' } } })
    await ctx.payload.update({
      collection: 'tenants', id: docs[0].id, overrideAccess: true,
      data: { ayraBlogs: { org: 'other-org', tokenEnv: 'BLOGS_TOKEN_A', author: { name: 'Sam Example' } } } as never,
    })
    const [r] = await run({ site: 'signalandsymptoms' })
    expect(r.problems[0]).toMatch(/no sync account/)
  })
  it('website keys never see a site’s AyraAgent settings', async () => {
    const [t] = await visible('tenants', 'readerA')
    expect(t.ayraBlogs).toBeUndefined()
  })
})

describe('the AyraAgent API client', () => {
  it('sends the org and token, and follows pages', async () => {
    const seen: { url: string; org: string | null; auth: string | null }[] = []
    const f = (async (url: string | URL | Request, init?: RequestInit) => {
      const h = new Headers(init?.headers)
      seen.push({ url: String(url), org: h.get('X-Ayra-Org'), auth: h.get('Authorization') })
      const page2 = String(url).includes('cursor=')
      return Response.json({ items: [{ id: page2 ? 'p2' : 'p1', title: 't', slug: 's', status: 'published', revision: 1 }], next_cursor: page2 ? null : 'c1' })
    }) as typeof fetch
    const items = await blogsApi({ base: 'https://api.example.test/', token: 'tok', org: 'demo-org', fetch: f }).list()
    expect(items.map((i) => i.id)).toEqual(['p1', 'p2'])
    expect(seen[0]).toMatchObject({ org: 'demo-org', auth: 'Bearer tok' })
    expect(seen[0].url).toBe('https://api.example.test/api/blogs?limit=50')
  })
  it('reports refusals with AyraAgent’s error code', async () => {
    const f = (async () => Response.json({ error: { code: 'blogs_forbidden' } }, { status: 403 })) as typeof fetch
    await expect(blogsApi({ base: 'https://api.example.test', token: 't', org: 'o', fetch: f }).list()).rejects.toThrow(/403 \(blogs_forbidden\)/)
  })
})
