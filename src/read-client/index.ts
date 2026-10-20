/**
 * Ayra CMS read client (task 6.1): how a website reads its own content from the CMS.
 *
 * Self-contained on purpose (no imports, no dependencies): a website copies this one file in,
 * whatever its framework. Use it on the SERVER only, at build time (D2: a site reads its
 * tenant when it builds; a person promotes production). The website key must never reach a
 * browser, so this refuses to run in one.
 *
 *   const cms = createCmsReader()            // AYRA_CMS_URL, AYRA_CMS_READ_KEY from env
 *   const page = await cms.page('/products/alpha')
 *   const refs = await cms.resolve(['claim:public-001', 'asset:orga/screen/hero@1'])
 *
 * What it can see is decided by the CMS, not by this file: a website key (role site-reader)
 * gets only its own site's approved, public, ungated records, with internal fields removed.
 * Before the first read the client checks that the key really is a website key for exactly one
 * site, and refuses otherwise: a person's key would also see drafts and internal records.
 */

export type Doc = { id: number | string; recordId?: string; [field: string]: unknown }
export type Where = Record<string, unknown>
export type ReaderOptions = {
  /** The CMS origin, e.g. https://cms.ayraagent.ai (default: env AYRA_CMS_URL). */
  url?: string
  /** The site's website key (default: env AYRA_CMS_READ_KEY). */
  apiKey?: string
  /** For tests or a custom transport. */
  fetch?: typeof fetch
  /** Depth of relationship population (default 1, which fills in images inside rich text). */
  depth?: number
}

/** Record-id prefix → collection. Trust documents are never readable with a website key. */
export const KIND_COLLECTION = {
  claim: 'claims',
  atom: 'atoms',
  asset: 'media',
  product: 'products',
  page: 'pages',
  post: 'posts',
  release: 'whats-new',
  deck: 'decks',
  legal: 'legal',
  audience: 'audiences',
  workflow: 'workflows',
} as const
export type ReadableCollection = (typeof KIND_COLLECTION)[keyof typeof KIND_COLLECTION] | 'site-settings'

const API = '/cms-api'

export class CmsReadError extends Error {}

/** qs-style query string: where[route][equals]=/x&where[and][0][status][equals]=approved */
export function toQuery(params: Record<string, unknown>): string {
  const out: string[] = []
  const walk = (prefix: string, value: unknown) => {
    if (value === undefined) return
    if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(prefix ? `${prefix}[${k}]` : k, v)
    } else {
      out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`)
    }
  }
  walk('', params)
  return out.join('&')
}

export function createCmsReader(options: ReaderOptions = {}) {
  if (typeof window !== 'undefined') {
    throw new CmsReadError('The CMS read client runs on the server only: the website key must never reach a browser.')
  }
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>
  const base = (options.url ?? env.AYRA_CMS_URL ?? '').trim().replace(/\/+$/, '')
  const apiKey = (options.apiKey ?? env.AYRA_CMS_READ_KEY ?? '').trim()
  const doFetch = options.fetch ?? fetch
  const depth = options.depth ?? 1

  if (!base) throw new CmsReadError('No CMS address: set AYRA_CMS_URL.')
  if (!apiKey) throw new CmsReadError('No website key: set AYRA_CMS_READ_KEY.')
  const origin = new URL(base)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  if (origin.protocol !== 'https:' && !local) throw new CmsReadError('The CMS address must be https (the key is sent with every request).')

  const cache = new Map<string, Promise<unknown>>()
  const get = <T>(path: string): Promise<T> => {
    if (!cache.has(path)) {
      const request = (async () => {
        const res = await doFetch(`${base}${API}${path}`, { headers: { Authorization: `users API-Key ${apiKey}`, Accept: 'application/json' } })
        if (!res.ok) {
          cache.delete(path) // do not keep a failure
          throw new CmsReadError(`CMS read failed (${res.status}) for ${API}${path.split('?')[0]}`)
        }
        return res.json()
      })()
      cache.set(path, request)
    }
    return cache.get(path) as Promise<T>
  }

  // The key must be a website key for exactly one site.
  let checked: Promise<{ tenant: number | string }> | undefined
  const ready = () =>
    (checked ??= get<{ user?: { role?: string; tenants?: { tenant: unknown }[] } | null }>('/users/me').then(({ user }) => {
      if (!user) throw new CmsReadError('The website key was not accepted by the CMS.')
      if (user.role !== 'site-reader') {
        throw new CmsReadError(`Refusing to read: this key belongs to a ${user.role ?? 'unknown'} account, not a website key, so it could see drafts and internal records.`)
      }
      const tenants = (user.tenants ?? []).map((t) => (t.tenant && typeof t.tenant === 'object' ? (t.tenant as { id: number | string }).id : t.tenant))
      if (tenants.length !== 1) throw new CmsReadError('Refusing to read: a website key belongs to exactly one site.')
      return { tenant: tenants[0] as number | string }
    }).catch((err) => {
      checked = undefined
      throw err
    }))

  /** Every matching document (all pages of results). */
  const list = async <T extends Doc = Doc>(collection: ReadableCollection, query: { where?: Where; sort?: string } = {}): Promise<T[]> => {
    await ready()
    const docs: T[] = []
    for (let page = 1; ; page++) {
      const res = await get<{ docs: T[]; hasNextPage?: boolean }>(
        `/${collection}?${toQuery({ where: query.where, sort: query.sort, depth, limit: 100, page })}`,
      )
      docs.push(...res.docs)
      if (!res.hasNextPage) return docs
    }
  }
  const first = async <T extends Doc = Doc>(collection: ReadableCollection, where: Where): Promise<T | null> =>
    (await list<T>(collection, { where }))[0] ?? null

  return {
    /** The key's site (checked once): useful to log at the start of a build. */
    site: ready,
    list,
    /** The site's settings (its shell: nav, footer, UI strings, domains). */
    siteSettings: () => list('site-settings').then((d) => d[0] ?? null),
    /** One page by its route, e.g. '/' or '/products/alpha'; null if absent or not public. */
    page: <T extends Doc = Doc>(route: string) => first<T>('pages', { route: { equals: route } }),
    /** One record by its record id, e.g. 'post:hello'; null if absent or not public. */
    record: <T extends Doc = Doc>(recordId: string) => {
      const collection = KIND_COLLECTION[recordId.split(':')[0] as keyof typeof KIND_COLLECTION]
      if (!collection) throw new CmsReadError(`Unknown record id prefix: ${recordId}`)
      return first<T>(collection, { recordId: { equals: recordId } })
    },
    /**
     * Resolves the ids a page or post cites (claim:…, atom:…, asset:…, product:…, deck:…, legal:…)
     * in one request per kind. Ids the site may not show are simply absent from the result: a
     * build should treat that as an error (the CMS refuses to approve such a page anyway).
     */
    resolve: async (ids: string[]): Promise<Map<string, Doc>> => {
      const byCollection = new Map<ReadableCollection, string[]>()
      for (const id of new Set(ids)) {
        const collection = KIND_COLLECTION[id.split(':')[0] as keyof typeof KIND_COLLECTION]
        if (!collection) throw new CmsReadError(`Unknown record id prefix: ${id}`)
        byCollection.set(collection, [...(byCollection.get(collection) ?? []), id])
      }
      const found = new Map<string, Doc>()
      for (const [collection, wanted] of byCollection) {
        for (const doc of await list(collection, { where: { recordId: { in: wanted } } })) found.set(String(doc.recordId), doc)
      }
      return found
    },
    /** The current published version of a legal page (privacy, terms, cookie, …). */
    legal: <T extends Doc = Doc>(type: string) =>
      first<T>('legal', { and: [{ type: { equals: type } }, { status: { equals: 'published' } }] }),
    /** Every public version of a legal page, newest first (the archive at /legal/<type>/<version>). */
    legalVersions: <T extends Doc = Doc>(type: string) => list<T>('legal', { where: { type: { equals: type } }, sort: '-effectiveAt' }),
    /** Approved public posts, newest first. */
    posts: <T extends Doc = Doc>() => list<T>('posts', { sort: '-publishedAt' }),
    /** Public What's New entries, newest first. */
    whatsNew: <T extends Doc = Doc>() => list<T>('whats-new', { sort: '-releasedAt' }),
  }
}

export type CmsReader = ReturnType<typeof createCmsReader>
