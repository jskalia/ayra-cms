/**
 * AyraAgent Blogs → posts: published blogs become drafts written by the site's sync account; a
 * person approves them (src/sync/approval.ts) and only then do websites see them; edits come
 * back for approval; archived ones retire; the public body carries no internal sources.
 * The AyraAgent API is faked here (its shape is the one the dev server returns).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { blogsApi, cleanBody, fileSource, mapBlog, postSlug, restStore, runBlogImport, type AyraBlog, type BlogsApi } from '../src/sync/blogs'
import { canApprove, decidePost } from '../src/sync/approval'
import { asUser, ctx, setup, teardown, visible } from './setup'

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
  it('maps a blog to a pending draft (public once approved) with internal sources and short SEO fields', () => {
    const p = mapBlog(blog('x', { title: 'T'.repeat(80) }), { name: 'Sam Example' })
    expect(p).toMatchObject({ recordId: 'post:widget-update-x', status: 'draft', visibility: 'public', origin: 'ayra-blogs', externalId: 'x', review: { state: 'pending' } })
    expect((p.seo as { title: string }).title.length).toBeLessThanOrEqual(60)
    expect((p.sources as { file: string }[])[0].file).toBe('design-notes.md')
    expect((p.review as { revision: string }).revision).toBe('1')
    expect(p.approved).toBeUndefined() // nobody has approved it yet
  })
})

describe('importing into a site', () => {
  it('a published blog arrives as a draft the website does not see, with its internal sources kept', async () => {
    store.set('b1', blog('b1'))
    store.set('d1', blog('d1', { status: 'draft' })) // drafts are never imported
    const [r] = await run()
    expect(r.problems).toEqual([])
    expect(r.counts).toMatchObject({ create: 1, update: 0, retire: 0 })
    expect(r.receiptId).toBeTruthy()
    expect(r.deployHook).toBeUndefined() // a new draft changes nothing on the website
    expect(hooks).toEqual([])
    expect(await post('readerA', 'post:widget-update-b1')).toBeUndefined()
    expect(await post('readerA', 'post:widget-update-d1')).toBeUndefined()
    // People of the site see it, where it came from, and that it waits for approval.
    const internal = await post('viewerA', 'post:widget-update-b1')
    expect(internal).toMatchObject({ origin: 'ayra-blogs', status: 'draft', review: { state: 'pending', revision: '1' } })
    expect(internal!.bodyMarkdown).not.toMatch(/Sources|_projects|\[\^/)
    expect(internal!.body).toBeTruthy()
    expect((internal!.sources as unknown[]).length).toBe(1)
  })
  it('approving makes it public: who and when are recorded, and the website deploy starts', async () => {
    const id = (await post('viewerA', 'post:widget-update-b1'))!.id
    const r = await decidePost({ payload: ctx.payload, user: ctx.users.viewerA as never, postId: id, decision: 'approve', env, fetch: fakeFetch, now: () => new Date('2026-10-22T12:00:00Z') })
    expect(r).toMatchObject({ ok: true, deployHook: 'called' })
    expect(hooks).toEqual(['https://hooks.example.test/a'])
    const site = await post('readerA', 'post:widget-update-b1')
    expect(site).toBeDefined()
    expect(site!.approved).toMatchObject({ by: 'viewerA', at: '2026-10-22', version: '1' })
    for (const hidden of ['sources', 'externalId', 'sync', 'review']) expect(site![hidden]).toBeUndefined()
    hooks.length = 0
  })
  it('running again changes nothing, files no receipt and starts no rebuild', async () => {
    hooks.length = 0
    const [r] = await run()
    expect(r.counts).toMatchObject({ create: 0, update: 0, unchanged: 1, retire: 0 })
    expect(r.receiptId).toBeUndefined()
    expect(hooks).toEqual([])
  })
  it('running again after the approval still changes nothing: a decision is never undone', async () => {
    const [r] = await run()
    expect(r.counts).toMatchObject({ create: 0, update: 0, unchanged: 1 })
    expect((await post('viewerA', 'post:widget-update-b1'))!.status).toBe('approved')
  })
  it('an edited blog goes back for approval and leaves the website; a renamed slug keeps the record id', async () => {
    store.set('b1', blog('b1', { revision: 2, title: 'Widget update, revised', slug: 'a-new-slug' }))
    const [r] = await run()
    expect(r.counts.update).toBe(1)
    expect(r.deployHook).toBe('called') // a live post stopped being live
    const p = await post('viewerA', 'post:widget-update-b1')
    expect(p).toMatchObject({ title: 'Widget update, revised', status: 'draft', review: { state: 'pending', revision: '2', previouslyApproved: true } })
    expect(p!.approved).toMatchObject({ by: null })
    expect(await post('readerA', 'post:widget-update-b1')).toBeUndefined()
    expect(await post('viewerA', 'post:a-new-slug')).toBeUndefined()
    hooks.length = 0
  })
  it('an archived blog retires its post: gone from the website, never deleted', async () => {
    store.set('b1', { ...store.get('b1')!, status: 'archived' })
    const [r] = await run()
    expect(r.counts.retire).toBe(1)
    expect(await post('readerA', 'post:widget-update-b1')).toBeUndefined()
    expect((await post('viewerA', 'post:widget-update-b1'))!.status).toBe('retired')
  })
  it('publishing it again brings it back as a draft to approve', async () => {
    store.set('b1', { ...store.get('b1')!, status: 'published' })
    const [r] = await run()
    expect(r.counts.update).toBe(1)
    expect(await post('readerA', 'post:widget-update-b1')).toBeUndefined()
    expect(await post('viewerA', 'post:widget-update-b1')).toMatchObject({ status: 'draft', review: { state: 'pending' } })
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
    expect(await post('viewerA', 'post:widget-update-good')).toBeDefined()
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

describe('importing a blog file over HTTPS, as the site’s sync account (no database access)', () => {
  let restFetch: typeof fetch
  beforeAll(async () => {
    await ctx.payload.update({ collection: 'users', id: ctx.users.syncA.id, overrideAccess: true, data: { enableAPIKey: true, apiKey: 'test-sync-key-a-0000000000000000000' } as never })
    await ctx.payload.update({ collection: 'users', id: ctx.users.readerA.id, overrideAccess: true, data: { enableAPIKey: true, apiKey: 'test-reader-key-a-00000000000000000' } as never })
    const { REST_GET, REST_POST, REST_PATCH } = await import('@payloadcms/next/routes')
    const { default: config } = await import('../payload.config')
    const handlers = { GET: REST_GET(config), POST: REST_POST(config), PATCH: REST_PATCH(config) } as const
    restFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      const slug = url.pathname.replace(/^\/cms-api\//, '').split('/')
      const method = (init?.method ?? 'GET') as keyof typeof handlers
      return handlers[method](new Request(url, init), { params: Promise.resolve({ slug }) })
    }) as typeof fetch
  })
  const store = (apiKey = 'test-sync-key-a-0000000000000000000') => restStore({ base: 'http://localhost:3000', apiKey, fetch: restFetch })

  it('creates the post through the CMS API, with a receipt, and never retires other posts', async () => {
    const before = (await visible('posts', 'viewerA')).filter((d) => d.origin === 'ayra-blogs').length
    const [r] = await runBlogImport({
      store: store(), site: 'savelifeai', source: fileSource([blog('file-1', { slug: 'from-a-file' })]), env: {}, fetch: fakeFetch,
    })
    expect(r.problems).toEqual([])
    expect(r.counts).toMatchObject({ create: 1, retire: 0 })
    expect(r.receiptId).toBeTruthy()
    expect(await post('viewerA', 'post:from-a-file')).toMatchObject({ status: 'draft' })
    expect(await post('readerA', 'post:from-a-file')).toBeUndefined()
    const after = (await visible('posts', 'viewerA')).filter((d) => d.origin === 'ayra-blogs').length
    expect(after).toBe(before + 1)
  })
  it('a second run over HTTPS changes nothing', async () => {
    const [r] = await runBlogImport({ store: store(), site: 'savelifeai', source: fileSource([blog('file-1', { slug: 'from-a-file' })]), env: {} })
    expect(r.counts).toMatchObject({ create: 0, update: 0, unchanged: 1 })
  })
  it('a website key cannot write posts', async () => {
    // It cannot even see the site's AyraAgent settings, so there is nothing it may import into.
    const results = await runBlogImport({ store: store('test-reader-key-a-00000000000000000'), site: 'savelifeai', source: fileSource([blog('file-2')]), env: {} })
    expect(results).toEqual([])
    expect(await post('viewerA', 'post:widget-update-file-2')).toBeUndefined()
  })
  it('a key cannot reach another site', async () => {
    expect(await store().tenants('junaidkalia')).toEqual([])
  })
})

describe('approving and sending back in the control room', () => {
  const draft = async (id: string) => {
    store.set(id, blog(id))
    await run()
    return (await post('viewerA', `post:widget-update-${id}`))!
  }
  const decide = (who: string, postId: number | string, decision: 'approve' | 'send-back') =>
    decidePost({ payload: ctx.payload, user: ctx.users[who] as never, postId, decision, env, fetch: fakeFetch })

  it('who may approve: admins, and viewers of that site; nobody else', () => {
    expect(canApprove(ctx.users.admin as never, ctx.tenantA)).toBe(true)
    expect(canApprove(ctx.users.viewerA as never, ctx.tenantA)).toBe(true)
    expect(canApprove(ctx.users.viewerA as never, ctx.tenantB)).toBe(false)
    expect(canApprove(ctx.users.readerA as never, ctx.tenantA)).toBe(false)
    expect(canApprove(ctx.users.syncA as never, ctx.tenantA)).toBe(false)
  })
  it('sending back keeps it off the website, and a re-import does not undo it', async () => {
    const p = await draft('sb1')
    expect(await decide('viewerA', p.id, 'send-back')).toMatchObject({ ok: true })
    expect(await post('viewerA', 'post:widget-update-sb1')).toMatchObject({ status: 'draft', review: { state: 'sent-back', decidedBy: 'viewerA' } })
    expect(await decide('viewerA', p.id, 'send-back')).toMatchObject({ ok: false, status: 409 })
    const [r] = await run()
    expect(r.counts.update).toBe(0)
    expect((await post('viewerA', 'post:widget-update-sb1'))!.review).toMatchObject({ state: 'sent-back' })
    // A new version from AyraAgent comes back to the queue.
    store.set('sb1', blog('sb1', { revision: 2, body_markdown: BODY.replace('## Sources', 'One more paragraph.\n\n## Sources') }))
    await run()
    expect((await post('viewerA', 'post:widget-update-sb1'))!.review).toMatchObject({ state: 'pending', revision: '2' })
    expect(await post('readerA', 'post:widget-update-sb1')).toBeUndefined()
  })
  it('an admin can approve any site’s blog, once', async () => {
    const p = await draft('ad1')
    expect(await decide('admin', p.id, 'approve')).toMatchObject({ ok: true })
    expect(await post('readerA', 'post:widget-update-ad1')).toBeDefined()
    expect(await decide('admin', p.id, 'approve')).toMatchObject({ ok: false, status: 409 })
    expect(await decide('admin', p.id, 'send-back')).toMatchObject({ ok: false, status: 409 })
  })
  it('someone from another site, a website key or the sync account gets "not found"', async () => {
    const p = await draft('nf1')
    const other = (await ctx.payload.create({
      collection: 'users', data: { name: 'viewerB', role: 'editor', email: 'viewerB@example.test', password: 'test-only-password', tenants: [{ tenant: ctx.tenantB }] } as never,
    })) as never
    for (const user of [other, ctx.users.readerA, ctx.users.syncA]) {
      expect(await decidePost({ payload: ctx.payload, user: user as never, postId: p.id, decision: 'approve', env })).toMatchObject({ ok: false, status: 404 })
    }
    expect((await post('viewerA', 'post:widget-update-nf1'))!.status).toBe('draft')
  })
  it('a post without an author is refused, in the rule’s words', async () => {
    const p = await draft('na1')
    await ctx.payload.update({ collection: 'posts', id: p.id, overrideAccess: true, data: { author: { name: '' } } as never })
    const r = await decide('viewerA', p.id, 'approve')
    expect(r).toMatchObject({ ok: false, status: 422 })
    expect((r as { message: string }).message).toMatch(/author/i)
    expect((await post('viewerA', 'post:widget-update-na1'))!.status).toBe('draft')
  })
  it('only AyraAgent blogs are approved here; a post from _ops is left to its own flow', async () => {
    const [opsPost] = (await visible('posts', 'viewerA')).filter((d) => d.origin === 'ops')
    expect(opsPost).toBeDefined()
    expect(await decide('viewerA', opsPost.id, 'approve')).toMatchObject({ ok: false, status: 400 })
  })
  it('an approver cannot change anything else about a post through the website’s or the viewer’s own access', async () => {
    const p = await draft('ro1')
    await expect(ctx.payload.update({ collection: 'posts', id: p.id, ...asUser('viewerA'), data: { status: 'approved' } as never })).rejects.toThrow()
  })
})
