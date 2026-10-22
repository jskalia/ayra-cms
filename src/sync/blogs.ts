/**
 * AyraAgent Blogs → this site's posts.
 *
 * Blogs are written in AyraAgent (its Blogs page: a brief, a template, and a draft grounded in
 * the organization's ops folder) and published there by an org admin. This imports them:
 *
 *  1. For each site whose `ayraBlogs.org` is set, read that org's blogs from the AyraAgent API
 *     with a read-only service token (env var named by `ayraBlogs.tokenEnv`; never stored here).
 *  2. Each **published** blog becomes an approved, public post, written by the site's sync
 *     account (people still never write content). The body is cleaned for the public site: the
 *     internal "## Sources" list, the [^n] markers and placeholder images are removed; the cited
 *     sources are kept in an internal field the websites never see.
 *  3. A blog that is no longer published (archived, back to draft, gone) retires its post:
 *     hidden from websites, never deleted.
 *  4. A receipt is filed (only when something changed or went wrong), and the site's preview
 *     deploy hook is called when posts changed. A person still promotes production.
 *
 * Unchanged blogs are skipped by a fingerprint of the mapped post, so running it often is cheap.
 */
import { randomBytes } from 'node:crypto'
import type { Payload, TypedUser, Where } from 'payload'

import { canonical, sha256 } from './read'

export type AyraBlog = {
  id: string
  org_id?: string
  title: string
  slug: string
  status: 'draft' | 'published' | 'archived' | string
  summary?: string | null
  revision: number
  published_at?: string | null
  body_markdown?: string | null
  sources?: { n?: number; file_name?: string; source_path?: string; sha256?: string; excerpt?: string }[] | null
  seo?: { slug?: string; meta_description?: string; keywords?: string[]; canonical_url?: string } | null
  settings?: { keywords?: string[] } | null
}

export type BlogsApi = { list(): Promise<AyraBlog[]>; get(id: string): Promise<AyraBlog> }

export class BlogsApiError extends Error {}

/** The AyraAgent Blogs API for one organization (X-Ayra-Org), read-only. */
export function blogsApi({ base, token, org, fetch: doFetch = fetch }: { base: string; token: string; org: string; fetch?: typeof fetch }): BlogsApi {
  const call = async <T>(path: string): Promise<T> => {
    const res = await doFetch(`${base.replace(/\/+$/, '')}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Ayra-Org': org, Accept: 'application/json' },
    })
    if (!res.ok) {
      let code = ''
      try {
        code = ((await res.json()) as { error?: { code?: string } }).error?.code ?? ''
      } catch {
        // not JSON
      }
      throw new BlogsApiError(`AyraAgent Blogs ${path.split('?')[0]} answered ${res.status}${code ? ` (${code})` : ''}`)
    }
    return (await res.json()) as T
  }
  return {
    async list() {
      const all: AyraBlog[] = []
      let cursor: string | null | undefined
      do {
        const page = await call<{ items: AyraBlog[]; next_cursor?: string | null }>(
          `/api/blogs?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        )
        all.push(...page.items)
        cursor = page.next_cursor
      } while (cursor)
      return all
    },
    get: (id) => call<AyraBlog>(`/api/blogs/${encodeURIComponent(id)}`),
  }
}

/** The body as the public site should show it: no internal Sources list, no [^n] markers, no placeholder images, no repeated title. */
export function cleanBody(markdown: string): string {
  let md = markdown.replace(/\r\n/g, '\n')
  md = md.replace(/\n#{1,6}\s*Sources\s*\n[\s\S]*$/i, '\n') // the server-built Sources section is always last
  md = md.replace(/^\[\^\d+\]:.*$/gm, '') // any stray footnote definitions
  md = md.replace(/\[\^\d+\]/g, '') // footnote markers
  md = md.replace(/!\[[^\]]*\]\(ayra-image:[^)]*\)\s*/g, '') // suggested images, not real files
  md = md.replace(/^\s*#\s+[^\n]*\n/, '') // the leading title (the site renders the title itself)
  return md.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** A post slug the CMS accepts (lowercase words joined by single hyphens). */
export const postSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
    .replace(/-+$/, '')

const cut = (value: string | null | undefined, max: number) => {
  const s = (value ?? '').trim()
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`
}

export type BlogAuthor = { name?: string | null; jobTitle?: string | null; url?: string | null }

/** One published AyraAgent blog as this CMS's post record. */
export function mapBlog(blog: AyraBlog, author: BlogAuthor, org: string): Record<string, unknown> {
  const slug = postSlug(blog.slug || blog.title)
  const description = blog.summary || blog.seo?.meta_description || ''
  return {
    recordId: `post:${slug}`,
    slug,
    title: blog.title,
    excerpt: description || undefined,
    bodyMarkdown: cleanBody(blog.body_markdown ?? ''),
    author: { name: author.name ?? undefined, jobTitle: author.jobTitle ?? undefined, url: author.url ?? undefined },
    tags: blog.settings?.keywords ?? blog.seo?.keywords ?? [],
    publishedAt: blog.published_at ?? undefined,
    seo: { title: cut(blog.title, 60), description: cut(description, 155) || undefined, canonical: blog.seo?.canonical_url || undefined },
    visibility: 'public',
    status: 'approved',
    approved: { by: `AyraAgent Blogs (${org})`, at: (blog.published_at ?? '').slice(0, 10), version: String(blog.revision) },
    origin: 'ayra-blogs',
    externalId: blog.id,
    sources: (blog.sources ?? []).map((s) => ({
      n: s.n, file: s.file_name, path: s.source_path, sha256: s.sha256, excerpt: cut(s.excerpt, 300),
    })),
  }
}

export type BlogAction = 'create' | 'update' | 'unchanged' | 'retire'
export type BlogItem = { collection: 'posts'; recordId: string; sourcePath: string; sha256: string; action: BlogAction }
export type SiteImport = {
  site: string
  org: string
  ok: boolean
  dryRun: boolean
  items: BlogItem[]
  counts: Record<BlogAction, number>
  problems: string[]
  receiptId?: string
  deployHook?: 'called' | 'failed' | 'not set'
}

export type Tenant = {
  id: number | string
  slug: string
  deployHookEnv?: string | null
  ayraBlogs?: { org?: string | null; tokenEnv?: string | null; author?: BlogAuthor | null } | null
}
export type PostDoc = { id: number | string; recordId: string; status: string; origin?: string; externalId?: string; sync?: { sourceSha256?: string } }

/** What the import writes through, as the site's sync account. */
export interface SiteWriter {
  posts(): Promise<PostDoc[]>
  create(data: Record<string, unknown>): Promise<void>
  update(id: number | string, data: Record<string, unknown>): Promise<void>
  lastRevision(): Promise<number>
  createReceipt(data: Record<string, unknown>): Promise<void>
}
/** Where the import finds sites and their sync accounts. */
export interface BlogStore {
  tenants(site?: string): Promise<Tenant[]>
  /** The site's writer, or why there is none. */
  writer(tenant: Tenant): Promise<SiteWriter | string>
}

/** Inside the CMS (the button, the schedule, tests): Payload's Local API, as the site's sync account. */
export function localStore(payload: Payload): BlogStore {
  return {
    async tenants(site) {
      const where: Where[] = [{ 'ayraBlogs.org': { exists: true } }, { 'ayraBlogs.org': { not_equals: '' } }]
      if (site) where.push({ slug: { equals: site } })
      const { docs } = await payload.find({ collection: 'tenants', overrideAccess: true, depth: 0, limit: 100, pagination: false, where: { and: where } })
      return docs as unknown as Tenant[]
    },
    async writer(tenant) {
      // Content is written by the site's own sync account, under every rule that applies to the sync.
      const { docs } = await payload.find({
        collection: 'users', overrideAccess: true, depth: 0, limit: 1,
        where: { and: [{ role: { equals: 'sync' } }, { 'tenants.tenant': { equals: tenant.id } }] },
      })
      if (!docs[0]) return 'this site has no sync account (an admin creates one with role "sync" for this site)'
      const as = { overrideAccess: false as const, user: { ...docs[0], collection: 'users' } as unknown as TypedUser }
      return {
        posts: async () =>
          (await payload.find({ collection: 'posts', ...as, depth: 0, pagination: false, where: { tenant: { equals: tenant.id } } })).docs as unknown as PostDoc[],
        create: async (data) => void (await payload.create({ collection: 'posts', ...as, data: data as never })),
        update: async (id, data) => void (await payload.update({ collection: 'posts', id, ...as, data: data as never })),
        lastRevision: async () => {
          const { docs: last } = await payload.find({
            collection: 'sync-receipts', overrideAccess: true, depth: 0, limit: 1, sort: '-revision', where: { tenant: { equals: tenant.id } },
          })
          return (last[0] as { revision?: number } | undefined)?.revision ?? 0
        },
        createReceipt: async (data) => void (await payload.create({ collection: 'sync-receipts', ...as, data: data as never })),
      }
    },
  }
}

/**
 * From anywhere else (a laptop): the CMS's REST API over HTTPS with the site's sync-account API
 * key. No database access needed; the key only reaches its own site, under every CMS rule.
 */
export function restStore({ base, apiKey, fetch: doFetch = fetch }: { base: string; apiKey: string; fetch?: typeof fetch }): BlogStore {
  const root = `${base.replace(/\/+$/, '')}/cms-api`
  const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await doFetch(`${root}${path}`, {
      ...init,
      headers: { Authorization: `users API-Key ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    })
    const body = (await res.json().catch(() => ({}))) as { errors?: { message?: string; data?: { errors?: { message?: string }[] } }[] }
    if (!res.ok) {
      const detail = (body.errors ?? []).flatMap((e) => (e.data?.errors?.length ? e.data.errors.map((d) => d.message) : [e.message])).filter(Boolean)
      throw new Error(`CMS ${init.method ?? 'GET'} ${path.split('?')[0]} answered ${res.status}${detail.length ? `: ${detail.join('; ')}` : ''}`)
    }
    return body as T
  }
  const all = async <T>(path: string): Promise<T[]> => {
    const out: T[] = []
    for (let page = 1; ; page++) {
      const res = await call<{ docs: T[]; hasNextPage?: boolean }>(`${path}&limit=100&page=${page}&depth=0`)
      out.push(...res.docs)
      if (!res.hasNextPage) return out
    }
  }
  return {
    async tenants(site) {
      const docs = await all<Tenant>(`/tenants?${site ? `where[slug][equals]=${encodeURIComponent(site)}` : 'where[ayraBlogs.org][exists]=true'}`)
      return docs.filter((t) => t.ayraBlogs?.org)
    },
    async writer(tenant) {
      return {
        posts: () => all<PostDoc>(`/posts?where[tenant][equals]=${tenant.id}`),
        create: async (data) => void (await call('/posts', { method: 'POST', body: JSON.stringify(data) })),
        update: async (id, data) => void (await call(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) })),
        lastRevision: async () => {
          const res = await call<{ docs: { revision?: number }[] }>(`/sync-receipts?where[tenant][equals]=${tenant.id}&sort=-revision&limit=1&depth=0`)
          return res.docs[0]?.revision ?? 0
        },
        createReceipt: async (data) => void (await call('/sync-receipts', { method: 'POST', body: JSON.stringify(data) })),
      }
    },
  }
}

export type ImportOptions = {
  /** Inside the CMS: its Payload instance (uses localStore). */
  payload?: Payload
  /** Or any store, e.g. restStore from a laptop. */
  store?: BlogStore
  /** Only this site (tenant slug); default: every site with an AyraAgent org. */
  site?: string
  env?: Record<string, string | undefined>
  /** The blogs' source for an org and token (default: the AyraAgent API). */
  api?: (org: string, token: string) => BlogsApi
  /** A fixed source instead of AyraAgent (e.g. blogs from a file); needs no token. */
  source?: BlogsApi
  /** Retire posts whose blog is no longer published (default true; off for a partial source like a file). */
  retire?: boolean
  fetch?: typeof fetch
  dryRun?: boolean
  actor?: string
  now?: () => Date
}

const countOf = (items: BlogItem[]) =>
  items.reduce((c, i) => ({ ...c, [i.action]: c[i.action] + 1 }), { create: 0, update: 0, unchanged: 0, retire: 0 } as Record<BlogAction, number>)

export async function runBlogImport(opts: ImportOptions): Promise<SiteImport[]> {
  const maybeStore = opts.store ?? (opts.payload ? localStore(opts.payload) : undefined)
  if (!maybeStore) throw new Error('runBlogImport needs a payload or a store')
  const store: BlogStore = maybeStore
  const env = opts.env ?? process.env
  const now = opts.now ?? (() => new Date())
  const base = env.AYRA_AGENT_API_BASE || 'https://api.ayraagent.ai'
  const api = opts.api ?? ((org: string, token: string) => blogsApi({ base, token, org, fetch: opts.fetch }))
  const retire = opts.retire ?? !opts.source

  const results: SiteImport[] = []
  for (const tenant of await store.tenants(opts.site)) results.push(await importSite(tenant))
  return results

  async function importSite(tenant: Tenant): Promise<SiteImport> {
    const startedAt = now()
    const org = String(tenant.ayraBlogs?.org)
    const result: SiteImport = { site: tenant.slug, org, ok: false, dryRun: Boolean(opts.dryRun), items: [], counts: countOf([]), problems: [] }
    const fail = (problem: string) => ((result.problems = [problem]), result)

    let source = opts.source
    if (!source) {
      const tokenEnv = tenant.ayraBlogs?.tokenEnv?.trim()
      const token = tokenEnv ? env[tokenEnv] : undefined
      if (!tokenEnv || !token) return fail(`no AyraAgent token: set ayraBlogs.tokenEnv and the ${tokenEnv || '<name>'} env var`)
      source = api(org, token)
    }
    const writer = await store.writer(tenant)
    if (typeof writer === 'string') return fail(writer)

    let blogs: AyraBlog[]
    let posts: PostDoc[]
    try {
      blogs = await source.list()
      posts = await writer.posts()
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err))
    }
    const byExternal = new Map(posts.filter((p) => p.origin === 'ayra-blogs' && p.externalId).map((p) => [String(p.externalId), p]))
    const byRecord = new Map(posts.map((p) => [p.recordId, p]))
    const author = tenant.ayraBlogs?.author ?? {}

    const plan: { item: BlogItem; id?: number | string; data?: Record<string, unknown> }[] = []
    const published = blogs.filter((b) => b.status === 'published')
    if (published.length && !author.name) result.problems.push('no author: set ayraBlogs.author.name (a real person, for BlogPosting JSON-LD)')
    else {
      for (const summary of published) {
        const sourcePath = `ayra-blogs/${org}/${summary.id}`
        try {
          const blog = await source.get(summary.id)
          const existing = byExternal.get(blog.id)
          const data = mapBlog(blog, author, org)
          if (existing) {
            // A post's record id and slug never change after it is created (pages cite them).
            data.recordId = existing.recordId
            data.slug = existing.recordId.slice('post:'.length)
          } else if (byRecord.has(String(data.recordId))) {
            result.problems.push(`${blog.title}: its slug "${data.slug}" is already used by another post in this site; not imported`)
            continue
          }
          const fingerprint = sha256(canonical(data))
          const action: BlogAction = !existing ? 'create' : existing.sync?.sourceSha256 === fingerprint && existing.status === 'approved' ? 'unchanged' : 'update'
          plan.push({ item: { collection: 'posts', recordId: String(data.recordId), sourcePath, sha256: fingerprint, action }, id: existing?.id, data })
        } catch (err) {
          result.problems.push(`${summary.title}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
    if (retire) {
      // Blogs no longer published (archived, back to draft, or gone) retire their posts.
      const live = new Set(published.map((b) => b.id))
      for (const [externalId, post] of byExternal) {
        if (!live.has(externalId) && post.status !== 'retired') {
          plan.push({
            item: { collection: 'posts', recordId: post.recordId, sourcePath: `ayra-blogs/${org}/${externalId}`, sha256: post.sync?.sourceSha256 ?? '', action: 'retire' },
            id: post.id,
          })
        }
      }
    }

    if (opts.dryRun) {
      result.items = plan.map((p) => p.item)
      result.counts = countOf(result.items)
      result.ok = result.problems.length === 0
      return result
    }

    const receiptId = `${startedAt.toISOString().replace(/[-:]/g, '').replace(/\..+/, '')}-${tenant.slug}-blogs-${randomBytes(3).toString('hex')}`
    for (const p of plan) {
      try {
        if (p.item.action === 'retire') await writer.update(p.id!, { status: 'retired' })
        else if (p.item.action !== 'unchanged') {
          const data = {
            ...p.data,
            tenant: tenant.id,
            sync: { sourcePath: p.item.sourcePath, sourceSha256: p.item.sha256, receipt: receiptId, syncedAt: now().toISOString() },
          }
          if (p.item.action === 'create') await writer.create(data)
          else await writer.update(p.id!, data)
        }
        result.items.push(p.item)
      } catch (err) {
        result.problems.push(`${p.item.recordId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    result.counts = countOf(result.items)
    result.ok = result.problems.length === 0
    const changed = result.counts.create + result.counts.update + result.counts.retire

    if (changed || result.problems.length) {
      await writer.createReceipt({
        receiptId, revision: (await writer.lastRevision()) + 1, status: result.ok ? 'ok' : 'failed', tenant: tenant.id,
        startedAt: startedAt.toISOString(), finishedAt: now().toISOString(), actor: opts.actor ?? 'ayra-blogs importer',
        sourceRoot: opts.source ? `blog file · org ${org}` : `AyraAgent Blogs · org ${org} · ${base}`,
        counts: result.counts, items: result.items, orphans: [], error: result.problems.join('; ') || undefined,
      })
      result.receiptId = receiptId
    }

    if (changed) {
      const hook = tenant.deployHookEnv ? env[tenant.deployHookEnv] : undefined
      if (!hook) result.deployHook = 'not set'
      else {
        try {
          const res = await (opts.fetch ?? fetch)(hook, { method: 'POST' })
          result.deployHook = res.ok ? 'called' : 'failed'
        } catch {
          result.deployHook = 'failed'
        }
      }
    }
    return result
  }
}

/** Blogs from a JSON file (one blog or a list) in AyraAgent's shape: for tests and imports before a token exists. */
export function fileSource(blogs: AyraBlog[]): BlogsApi {
  const byId = new Map(blogs.map((b) => [b.id, b]))
  return {
    list: async () => blogs,
    get: async (id) => {
      const b = byId.get(id)
      if (!b) throw new Error(`blog ${id} is not in the file`)
      return b
    },
  }
}
