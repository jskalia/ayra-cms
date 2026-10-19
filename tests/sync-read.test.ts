/** Phase 4a: reading and checking an _ops snapshot (no database needed). */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { checkSchemas, checkSnapshot } from '../src/sync/check'
import { readOps, type SyncRecord } from '../src/sync/read'

const FIXTURE = path.resolve(__dirname, 'fixtures/ops/_demo_ops')
const RECORDS = 'marketing/records'
const temps: string[] = []
afterEach(() => {
  while (temps.length) rmSync(temps.pop()!, { recursive: true, force: true })
})

/** A writable copy of the sample org, with one file edited. */
function copyWith(edit?: (root: string) => void): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ops-'))
  temps.push(root)
  cpSync(FIXTURE, root, { recursive: true })
  edit?.(root)
  return root
}
const editFile = (root: string, rel: string, fn: (s: string) => string) => {
  const p = path.join(root, RECORDS, rel)
  writeFileSync(p, fn(readFileSync(p, 'utf8')))
}
const find = (records: SyncRecord[], recordId: string) => records.find((r) => r.recordId === recordId)!

describe('reading the sample org', () => {
  const { records, problems } = readOps(FIXTURE, 'demo')

  it('reads every kind of record, with no problems', () => {
    expect(problems).toEqual([])
    const count = (c: string) => records.filter((r) => r.collection === c).length
    expect({
      site: count('site-settings'), products: count('products'), claims: count('claims'), atoms: count('atoms'),
      media: count('media'), pages: count('pages'), posts: count('posts'), whatsNew: count('whats-new'),
    }).toEqual({ site: 1, products: 1, claims: 3, atoms: 2, media: 1, pages: 2, posts: 1, whatsNew: 1 })
  })
  it('maps _ops field names to CMS field names', () => {
    const claim = find(records, 'claim:widget-speed-001').data as Record<string, any>
    expect(claim.source.lineOrSection).toBe('Performance')
    expect(claim.sha256).toBe('2'.repeat(64)) // from sha256_of_source_file
    const site = find(records, 'site:demo').data as Record<string, any>
    expect(site.domains.redirects[0].keepServed).toEqual(['/.well-known/assetlinks.json'])
    expect(site.forms[0].formId).toBe('contact')
    const post = find(records, 'post:hello-world').data as Record<string, any>
    expect(post.author).toEqual({ name: 'Sam Example', jobTitle: 'Product lead' })
    expect(post.bodyMarkdown).toContain('## Why it matters')
    const page = find(records, 'page:demo/home').data as Record<string, any>
    expect(page.blocks.map((b: { blockType: string }) => b.blockType)).toEqual(['hero-statement', 'workflow-diagram', 'proof-numbers'])
    const release = find(records, 'release:demo/2026-widget-launch').data as Record<string, any>
    expect(release.summary).toBe('Widget 1.0 sorts requests by urgency.')
    expect(release.features).toHaveLength(2)
    const atom = find(records, 'atom:widget-flow-001').data as Record<string, any>
    expect(atom.shape.before_after).toEqual({ before: 'Requests wait in one queue', after: 'Urgent requests go first' })
    expect(atom.shape.steps).toHaveLength(2)
  })
  it('the media record knows its file', () => {
    const asset = find(records, 'asset:demo/screen/widget-home@1')
    expect(asset.file?.mimetype).toBe('image/png')
    expect(asset.sourcePath).toBe(`${RECORDS}/products/widget/assets.index.json`)
  })
  it('hashes are stable, and change only for the record that changed', () => {
    const again = readOps(FIXTURE, 'demo').records
    expect(again.map((r) => r.sha256)).toEqual(records.map((r) => r.sha256))
    const root = copyWith((r) => editFile(r, 'products/widget/claims.json', (s) => s.replace('under one second', 'under two seconds')))
    const changed = readOps(root, 'demo').records
    const diff = changed.filter((r, i) => r.sha256 !== records[i].sha256).map((r) => r.recordId)
    expect(diff).toEqual(['claim:widget-speed-001'])
  })
  it('the sample snapshot passes the pre-flight check', () => {
    expect(checkSnapshot(records)).toEqual([])
  })
})

describe('the pre-flight check refuses a bad snapshot', () => {
  const problemsFor = (edit: (root: string) => void) => {
    const root = copyWith(edit)
    const { records, problems } = readOps(root, 'demo')
    return [...problems, ...checkSnapshot(records)]
  }
  it.each([
    ['a public page citing an investor-only claim', (r: string) => editFile(r, 'channels/web/demo/pages/home.md', (s) => s.replace('claim:widget-speed-001', 'claim:widget-roadmap-001')), 'not public'],
    ['a citation missing from the snapshot', (r: string) => editFile(r, 'channels/web/demo/pages/home.md', (s) => s.replace('claim:widget-speed-001', 'claim:nowhere-001')), 'not in this snapshot'],
    ['a citation in blog prose to an investor-only claim', (r: string) => editFile(r, 'channels/web/demo/pages/blog/hello-world.md', (s) => s.replace('(claim:widget-overview-001)', '(claim:widget-roadmap-001)')), 'not public'],
    ['a public atom resting on an investor-only claim', (r: string) => editFile(r, 'products/widget/atoms.json', (s) => s.replace('"claim:widget-overview-001"', '"claim:widget-roadmap-001"')), 'not public'],
    ['a duplicate claim id', (r: string) => editFile(r, 'products/widget/claims.json', (s) => s.replace('"widget-speed-001"', '"widget-overview-001"')), 'duplicate'],
    ['an upper-case id', (r: string) => editFile(r, 'products/widget/claims.json', (s) => s.replace('"widget-speed-001"', '"Widget-Speed-001"')), 'not a valid record id'],
    ['banned vocabulary', (r: string) => editFile(r, 'products/widget/claims.json', (s) => s.replace('Widget answers', 'The ' + 'Super' + 'App answers')), 'banned vocabulary'],
    ['an approved post with no author', (r: string) => editFile(r, 'channels/web/demo/pages/blog/hello-world.md', (s) => s.replace('author: {name: Sam Example, job_title: Product lead}\n', '')), 'real author'],
    ['an asset whose file does not match its hash', (r: string) => editFile(r, 'products/widget/assets.index.json', (s) => s.replace(/"sha256": "[a-f0-9]+"/, `"sha256": "${'0'.repeat(64)}"`)), 'does not match'],
    ['an asset pointing outside its product folder', (r: string) => editFile(r, 'products/widget/assets.index.json', (s) => s.replace('assets/widget-home.png', '../../../../../../etc/hosts')), 'inside the product folder'],
    ['a page with no front matter', (r: string) => editFile(r, 'channels/web/demo/pages/home.md', () => 'just text'), 'front matter'],
  ])('%s', (_label, edit, expected) => {
    const problems = problemsFor(edit as (root: string) => void)
    expect(problems.join('\n')).toContain(expected as string)
  })
})

// Sir's JSON Schemas are not copied into this public repo; point SCHEMAS_DIR at them to run this.
const schemasDir = process.env.SCHEMAS_DIR
describe.skipIf(!schemasDir)('Sir’s JSON Schemas (needs SCHEMAS_DIR)', () => {
  it('the sample claims.json and atoms.json pass', async () => {
    const { records } = readOps(FIXTURE, 'demo')
    expect(await checkSchemas(FIXTURE, records, schemasDir!)).toEqual([])
  })
  it('a claim missing its quote fails the schema', async () => {
    const root = copyWith((r) => editFile(r, 'products/widget/claims.json', (s) => s.replace('"quote": "under one second",', '')))
    const { records } = readOps(root, 'demo')
    expect((await checkSchemas(root, records, schemasDir!)).join('\n')).toContain('quote')
  })
})
