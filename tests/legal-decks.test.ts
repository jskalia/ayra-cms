/**
 * Phase 3d/3e: legal pages (versioned, never deleted, frozen once published), decks, trust
 * documents, consent records, audiences and workflows, and the sync's handling of legal versions.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { CollectionSlug, TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LocalClient } from '../src/sync/client'
import { runSync } from '../src/sync/run'
import { verifyReceipt, type Receipt } from '../src/sync/verify'
import { asUser, ctx, recordIds, setup, teardown, visible } from './setup'

beforeAll(setup, 180_000)
afterAll(teardown)

const create = (collection: CollectionSlug, who: string, data: Record<string, unknown>) =>
  ctx.payload.create({ collection, ...asUser(who), data: { tenant: ctx.tenantA, ...data } as never })
const update = (collection: CollectionSlug, who: string, id: number | string, data: Record<string, unknown>) =>
  ctx.payload.update({ collection, id, ...asUser(who), data: data as never })
/** Refused, with the reason (Payload keeps it in the error's data, not its message). */
const refused = async (p: Promise<unknown>, reason: RegExp) => {
  const err = await p.then(() => undefined, (e: { data?: { errors?: { message: string }[] } }) => e)
  expect(err, 'expected a refusal').toBeDefined()
  expect((err!.data?.errors ?? []).map((e) => e.message).join('\n')).toMatch(reason)
}
const byRecordId = async (collection: CollectionSlug, recordId: string, who = 'syncA') =>
  (await visible(collection, who)).find((d) => d.recordId === recordId)!

describe('legal pages', () => {
  it('a website sees published and superseded versions, never drafts', async () => {
    expect(await recordIds('legal', 'readerA')).toEqual(['legal:privacy@1'])
    expect(await recordIds('legal', 'viewerA')).toEqual(['legal:privacy@1', 'legal:terms@1'])
  })
  it('the record id is legal:<type>@<version>', async () => {
    await refused(create('legal', 'syncA', { recordId: 'legal:privacy@9', type: 'terms', version: '9', status: 'draft' }), /legal:<type>@<version>/)
    await expect(create('legal', 'syncA', { recordId: 'legal:privacy', type: 'privacy', version: '9', status: 'draft' })).rejects.toThrow()
  })
  it('a published version has an effective date', async () => {
    await expect(create('legal', 'syncA', { recordId: 'legal:cookie@1', type: 'cookie', version: '1', status: 'published' })).rejects.toThrow()
  })
  it('one published version per type: supersede the old one first', async () => {
    const next = { recordId: 'legal:privacy@2', type: 'privacy', version: '2', effectiveAt: '2026-11-01', status: 'published', bodyMarkdown: 'Privacy, second.' }
    await refused(create('legal', 'syncA', next), /already published/)
    const v1 = await byRecordId('legal', 'legal:privacy@1')
    await update('legal', 'syncA', v1.id, { status: 'superseded' })
    await create('legal', 'syncA', next)
    expect(await recordIds('legal', 'readerA')).toEqual(['legal:privacy@1', 'legal:privacy@2'])
    // Site B still has its own privacy@1 published: one per type is per site.
    expect((await byRecordId('legal', 'legal:privacy@1', 'syncB')).status).toBe('published')
  })
  it('once published, a version never changes', async () => {
    const v2 = await byRecordId('legal', 'legal:privacy@2')
    await refused(update('legal', 'syncA', v2.id, { bodyMarkdown: 'Quietly edited.' }), /never changes/)
    await refused(update('legal', 'syncA', v2.id, { changeSummary: 'rewritten' }), /never changes/)
    await refused(update('legal', 'syncA', v2.id, { status: 'draft' }), /cannot become draft/)
    const v1 = await byRecordId('legal', 'legal:privacy@1')
    await refused(update('legal', 'syncA', v1.id, { status: 'published' }), /cannot become published/)
  })
  it('a draft may still change', async () => {
    const draft = await byRecordId('legal', 'legal:terms@1')
    const changed = await update('legal', 'syncA', draft.id, { changeSummary: 'first terms' })
    expect((changed as { changeSummary?: string }).changeSummary).toBe('first terms')
  })
  it('nobody deletes a legal version, not even the sync', async () => {
    const v1 = await byRecordId('legal', 'legal:privacy@1')
    for (const who of ['syncA', 'admin', 'viewerA']) {
      await expect(ctx.payload.delete({ collection: 'legal', id: v1.id, ...asUser(who) })).rejects.toThrow()
    }
    expect((await ctx.payload.findByID({ collection: 'legal', id: v1.id })).recordId).toBe('legal:privacy@1')
  })
  it('published legal text cites public records only', async () => {
    const base = { type: 'disclosure', effectiveAt: '2026-10-01', status: 'published' }
    await refused(
      create('legal', 'syncA', { ...base, recordId: 'legal:disclosure@1', version: '1', bodyMarkdown: 'See claim:internal-001.' }),
      /not public/,
    )
    const ok = await create('legal', 'syncA', { ...base, recordId: 'legal:disclosure@1', version: '1', bodyMarkdown: 'See claim:public-001.' })
    expect(ok.id).toBeDefined()
  })
})

describe('decks', () => {
  it('a website sees approved, ungated decks only', async () => {
    expect(await recordIds('decks', 'readerA')).toEqual(['deck:overview'])
    expect(await recordIds('decks', 'viewerA')).toEqual(['deck:investor-2026', 'deck:overview'])
  })
  it('a public deck’s cover is an approved asset; a gated deck may use any asset of its site', async () => {
    const base = { title: 'Covers', status: 'approved', coverAsset: 'asset:orga/screen/img-draft@1' }
    await refused(create('decks', 'syncA', { ...base, recordId: 'deck:cover-public', gate: 'none' }), /not public/)
    expect((await create('decks', 'syncA', { ...base, recordId: 'deck:cover-gated', gate: 'partner' })).id).toBeDefined()
    await refused(
      create('decks', 'syncA', { ...base, recordId: 'deck:cover-other-site', gate: 'partner', coverAsset: 'asset:orgb/screen/img-approved@1' }),
      /missing/,
    )
  })
})

describe('trust documents', () => {
  it('no website key reads them; people of the site do', async () => {
    expect(await visible('trust-documents', 'readerA')).toEqual([])
    expect(await recordIds('trust-documents', 'viewerA')).toEqual(['trustdoc:soc2-report'])
  })
  it('only the sync writes them, and nobody deletes them', async () => {
    await expect(create('trust-documents', 'viewerA', { recordId: 'trustdoc:x', title: 'x' })).rejects.toThrow()
    await expect(create('trust-documents', 'readerA', { recordId: 'trustdoc:x', title: 'x' })).rejects.toThrow()
    const doc = await byRecordId('trust-documents', 'trustdoc:soc2-report')
    await expect(ctx.payload.delete({ collection: 'trust-documents', id: doc.id, ...asUser('syncA') })).rejects.toThrow()
  })
})

describe('pages citing the new kinds', () => {
  const page = (recordId: string, route: string, gate: string, cites: string[]) => ({
    recordId, template: 'portal', route, visibility: 'public', gate, status: 'approved',
    approved: { by: 'marketing.head', at: '2026-10-20' }, seo: { noindex: gate !== 'none' },
    blocks: [{ blockType: 'hero-statement', props: { cites } }],
  })
  it('a public page may cite a public deck and a published legal page', async () => {
    const ok = await create('pages', 'syncA', page('page:orga/decks', '/decks', 'none', ['deck:overview', 'legal:privacy@2']))
    expect(ok.id).toBeDefined()
  })
  it('a public page may not cite a gated deck, a legal draft, or a trust document', async () => {
    for (const ref of ['deck:investor-2026', 'legal:terms@1', 'trustdoc:soc2-report']) {
      await refused(create('pages', 'syncA', page(`page:orga/bad-${ref.split(':')[0]}`, `/bad-${ref.split(':')[0]}`, 'none', [ref])), /not public/)
    }
  })
  it('a gated page may cite gated records of its own site', async () => {
    const ok = await create('pages', 'syncA', page('page:orga/trust', '/trust', 'trust', ['trustdoc:soc2-report', 'deck:investor-2026']))
    expect(ok.id).toBeDefined()
  })
})

describe('consent records', () => {
  const consent = (extra: Record<string, unknown> = {}) => ({
    anonymousId: 'anon-test-abcdefghijkl', choices: { analytics: true, marketing: false }, policyVersion: 'cookie@1', gpc: true, region: 'eu-uk', ...extra,
  })
  it('the website key records consent in its own site only', async () => {
    expect((await create('consent-records', 'readerA', consent())).id).toBeDefined()
    await expect(create('consent-records', 'readerA', consent({ tenant: ctx.tenantB }))).rejects.toThrow()
  })
  it('nobody else creates them, and the website key cannot read them back', async () => {
    for (const who of ['syncA', 'viewerA', 'admin']) await expect(create('consent-records', who, consent())).rejects.toThrow()
    await expect(ctx.payload.create({ collection: 'consent-records', ...asUser(null), data: { ...consent(), tenant: ctx.tenantA } as never })).rejects.toThrow()
    expect(await visible('consent-records', 'readerA')).toEqual([])
  })
  it('people of the site read them; nobody edits or deletes them', async () => {
    const mine = await visible('consent-records', 'viewerA')
    expect(mine.length).toBe(2)
    for (const who of ['admin', 'viewerA', 'readerA', 'syncA']) {
      await expect(update('consent-records', who, mine[0].id, { policyVersion: 'cookie@2' })).rejects.toThrow()
      await expect(ctx.payload.delete({ collection: 'consent-records', id: mine[0].id, ...asUser(who) })).rejects.toThrow()
    }
  })
  it('holds no personal data and only yes/no choices', async () => {
    await expect(create('consent-records', 'readerA', consent({ choices: { email: 'pat@example.com' } }))).rejects.toThrow()
    await expect(create('consent-records', 'readerA', consent({ choices: { phone: '+1 415 555 0100' } }))).rejects.toThrow()
    await expect(create('consent-records', 'readerA', consent({ choices: { analytics: 'yes' } }))).rejects.toThrow()
    await expect(create('consent-records', 'readerA', consent({ anonymousId: 'pat@example.com' }))).rejects.toThrow()
  })
})

describe('audiences and workflows', () => {
  it('a website sees public, active ones only', async () => {
    expect(await recordIds('audiences', 'readerA')).toEqual(['audience:clinics'])
    expect(await recordIds('workflows', 'readerA')).toEqual(['workflow:triage'])
    expect((await recordIds('audiences', 'viewerA')).length).toBe(2)
  })
})

describe('the sync and legal versions', () => {
  let ops: string
  let tenant: number | string
  const FIXTURE = path.resolve(__dirname, 'fixtures/ops/_demo_ops')
  const legalFile = (version: string, body: string) => {
    const dir = path.join(ops, 'marketing/records/channels/web/demo/legal')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      path.join(dir, 'privacy.md'),
      `---\nversion: ${version}\neffective_at: 2026-1${version}-01\nmaterial: false\nchange_summary: version ${version}\n---\n\n${body}\n`,
    )
  }
  const client = () => new LocalClient(ctx.payload, { ...ctx.users.syncDemo, collection: 'users' } as unknown as TypedUser)
  const sync = (dryRun = false) =>
    runSync({ orgRoot: ops, site: 'demo', tenant: 'ayraagent', actor: 'test-runner', dryRun, receiptToOps: false, client: client() })
  const legalRows = async () =>
    ((await ctx.payload.find({ collection: 'legal', where: { tenant: { equals: tenant } }, sort: 'recordId', depth: 0 })).docs as { recordId: string; status: string }[]).map(
      (d) => `${d.recordId} ${d.status}`,
    )

  beforeAll(async () => {
    ops = mkdtempSync(path.join(os.tmpdir(), 'ops-legal-'))
    cpSync(FIXTURE, ops, { recursive: true })
    const { docs } = await ctx.payload.find({ collection: 'tenants', where: { slug: { equals: 'ayraagent' } } })
    tenant = docs[0].id
    ctx.users.syncDemo = (await ctx.payload.create({
      collection: 'users',
      data: { name: 'syncDemo', role: 'sync', email: 'syncdemo@example.test', password: 'test-only-password', tenants: [{ tenant }] } as never,
    })) as never
  })
  afterAll(() => rmSync(ops, { recursive: true, force: true }))

  it('publishes the legal page from _ops', async () => {
    legalFile('1', 'Our privacy notice, first version.')
    const res = await sync()
    expect(res.problems).toEqual([])
    expect(res.ok).toBe(true)
    expect(await legalRows()).toEqual(['legal:privacy@1 published'])
  })
  it('a new version supersedes the old one, which is kept and is not an orphan', async () => {
    legalFile('2', 'Our privacy notice, second version.')
    const plan = await sync(true)
    expect(plan.items.filter((i) => i.collection === 'legal').map((i) => `${i.recordId} ${i.action}`)).toEqual([
      'legal:privacy@1 supersede',
      'legal:privacy@2 create',
    ])
    const res = await sync()
    expect(res.ok).toBe(true)
    expect(await legalRows()).toEqual(['legal:privacy@1 superseded', 'legal:privacy@2 published'])
    expect(res.counts.supersede).toBe(1)
    const receipt = (await client().receipt(tenant, res.receiptId!)) as unknown as Receipt
    expect((await verifyReceipt(client(), 'ayraagent', receipt)).ok).toBe(true)
    const again = await sync()
    expect(again.counts.create + again.counts.update + again.counts.supersede).toBe(0)
    expect(again.orphans.filter((o) => o.collection === 'legal')).toEqual([])
  })
  it('changed text under the same version is refused before anything is written', async () => {
    legalFile('2', 'Quietly edited text.')
    const res = await sync()
    expect(res.ok).toBe(false)
    expect(res.problems.join('\n')).toMatch(/legal:privacy@2: this version is already published/)
    expect(await legalRows()).toEqual(['legal:privacy@1 superseded', 'legal:privacy@2 published'])
  })
  it('an older snapshot (rollback) never un-publishes the current version', async () => {
    legalFile('1', 'Our privacy notice, first version.')
    const res = await sync()
    expect(res.ok).toBe(true)
    expect(await legalRows()).toEqual(['legal:privacy@1 superseded', 'legal:privacy@2 published'])
  })
})
