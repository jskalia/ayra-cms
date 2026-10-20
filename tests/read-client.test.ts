/**
 * Phase 6.1: the read client a website uses, over the CMS's real REST handler (the same code
 * that serves cms.ayraagent.ai/cms-api), authenticated with real API keys.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createCmsReader, toQuery, type ReaderOptions } from '../src/read-client'
import { ctx, setup, teardown } from './setup'

let restFetch: typeof fetch
const KEYS: Record<string, string> = {
  readerA: 'test-key-reader-a-000000000000000000',
  readerB: 'test-key-reader-b-000000000000000000',
  viewerA: 'test-key-viewer-a-000000000000000000',
  syncA: 'test-key-sync-a-00000000000000000000',
}

beforeAll(async () => {
  await setup()
  for (const [who, apiKey] of Object.entries(KEYS)) {
    await ctx.payload.update({ collection: 'users', id: ctx.users[who].id, data: { enableAPIKey: true, apiKey } as never })
  }
  const { REST_GET } = await import('@payloadcms/next/routes')
  const { default: config } = await import('../payload.config')
  const handler = REST_GET(config)
  restFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const slug = url.pathname.replace(/^\/cms-api\//, '').split('/')
    return handler(new Request(url, init), { params: Promise.resolve({ slug }) })
  }) as typeof fetch
}, 180_000)
afterAll(teardown)

const reader = (who: string | null, extra: ReaderOptions = {}) =>
  createCmsReader({ url: 'http://localhost:3000', apiKey: who ? KEYS[who] : 'not-a-key', fetch: restFetch, ...extra })

describe('a website reads its own site', () => {
  it('knows its site', async () => {
    expect((await reader('readerA').site()).tenant).toBe(ctx.tenantA)
  })
  it('reads a public page by route, and nothing else', async () => {
    const cms = reader('readerA')
    expect((await cms.page('/products/alpha'))?.recordId).toBe('page:orga/products-alpha')
    expect(await cms.page('/does-not-exist')).toBeNull()
  })
  it('reads only approved, public posts, legal versions and decks', async () => {
    const cms = reader('readerA')
    expect((await cms.posts()).map((p) => p.recordId)).toEqual(['post:hello'])
    expect((await cms.legal('privacy'))?.recordId).toBe('legal:privacy@1')
    expect(await cms.legal('terms')).toBeNull() // a draft
    expect((await cms.list('decks')).map((d) => d.recordId)).toEqual(['deck:overview'])
  })
  it('resolves what a page cites; ids it may not show are absent', async () => {
    const found = await reader('readerA').resolve(['claim:public-001', 'claim:internal-001', 'asset:orga/screen/img-approved@1', 'product:alpha'])
    expect([...found.keys()].sort()).toEqual(['asset:orga/screen/img-approved@1', 'claim:public-001', 'product:alpha'])
    expect(found.get('claim:public-001')?.source).toBeUndefined() // internal fields stay hidden
  })
  it('never sees another site', async () => {
    const b = reader('readerB')
    expect((await b.site()).tenant).toBe(ctx.tenantB)
    const titles = (await b.posts()).map((p) => p.title)
    expect(titles).toEqual(['Published b'])
  })
  it('reads site settings without the internal fields', async () => {
    const s = await reader('readerA').siteSettings()
    expect(s?.recordId).toBe('site:sitea')
    expect(s?.owners).toBeUndefined()
  })
})

describe('the client refuses unsafe setups', () => {
  it('refuses a person’s key (it could see drafts)', async () => {
    await expect(reader('viewerA').posts()).rejects.toThrow(/not a website key/)
  })
  it('refuses the sync account’s key', async () => {
    await expect(reader('syncA').posts()).rejects.toThrow(/not a website key/)
  })
  it('refuses a wrong key', async () => {
    await expect(reader(null).posts()).rejects.toThrow(/not accepted|read failed/)
  })
  it('refuses plain http to a non-local address, and missing settings', () => {
    expect(() => createCmsReader({ url: 'http://cms.example.com', apiKey: 'k' })).toThrow(/https/)
    expect(() => createCmsReader({ url: '', apiKey: 'k' })).toThrow(/AYRA_CMS_URL/)
    expect(() => createCmsReader({ url: 'https://cms.example.com', apiKey: '' })).toThrow(/AYRA_CMS_READ_KEY/)
  })
  it('refuses to run in a browser', () => {
    const g = globalThis as { window?: unknown }
    g.window = {}
    try {
      expect(() => createCmsReader({ url: 'https://cms.example.com', apiKey: 'k' })).toThrow(/server only/)
    } finally {
      delete g.window
    }
  })
})

describe('query strings', () => {
  it('encodes nested where clauses the way Payload reads them', () => {
    expect(decodeURIComponent(toQuery({ where: { and: [{ type: { equals: 'privacy' } }] }, limit: 100 }))).toBe(
      'where[and][0][type][equals]=privacy&limit=100',
    )
    expect(toQuery({ where: { route: { equals: '/a b&c' } } })).toBe('where%5Broute%5D%5Bequals%5D=%2Fa%20b%26c')
  })
})
