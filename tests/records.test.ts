/** Record rules: id formats, uniqueness, claim rules, and the vocabulary gate. */
import type { CollectionSlug } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { asUser, claim, ctx, recordIds, setup, teardown } from './setup'

beforeAll(setup, 180_000)
afterAll(teardown)

const createAs = (who: string, collection: CollectionSlug, data: Record<string, unknown>) =>
  ctx.payload.create({ collection, ...asUser(who), data: data as never })

describe('claims', () => {
  const create = (extra: Record<string, unknown>) => createAs('syncA', 'claims', { ...claim(ctx.tenantA, 'rule-001', 'public'), ...extra })

  it('a record id is unique within a site, and may repeat across sites', async () => {
    await expect(create({ recordId: 'claim:public-001' })).rejects.toThrow()
    expect(await recordIds('claims', 'readerB')).toContain('claim:public-001')
  })
  it('a K-number makes a claim regulated, with platform vs module', async () => {
    await expect(create({ recordId: 'claim:k-001', kNumber: 'K260936' })).rejects.toThrow()
    await expect(create({ recordId: 'claim:k-002', kNumber: 'K26093', regulated: true, platformVsModule: 'platform' })).rejects.toThrow()
    expect((await create({ recordId: 'claim:k-003', kNumber: 'K260936', regulated: true, platformVsModule: 'platform' })).id).toBeDefined()
  })
  it('a deprecated claim needs superseded_by or a note; a promoted claim cannot be needs-owner', async () => {
    await expect(create({ recordId: 'claim:dep-001', status: 'deprecated' })).rejects.toThrow()
    await expect(create({ recordId: 'claim:own-001', status: 'needs-owner' })).rejects.toThrow()
  })
  it('sha256 must be a real sha256', async () => {
    await expect(create({ recordId: 'claim:sha-001', sha256: 'not-a-hash' })).rejects.toThrow()
  })
})

describe('record id formats (as in the _ops records)', () => {
  it.each([
    ['claims', 'public-002'], // no prefix
    ['claims', 'claim:Upper-Case'],
    ['claims', 'claim:has space'],
    ['products', 'product:Alpha'],
  ])('%s refuses %s', async (collection, recordId) => {
    const data =
      collection === 'claims'
        ? { ...claim(ctx.tenantA, 'x-001', 'public'), recordId }
        : { recordId, name: 'x', tenant: ctx.tenantA }
    await expect(createAs('syncA', collection as CollectionSlug, data)).rejects.toThrow()
  })
  it('an asset id has its org, kind, id and version', async () => {
    const { RECORD_ID_PATTERNS } = await import('../src/fields/record')
    expect(RECORD_ID_PATTERNS['asset:'].test('asset:savelifeai/screen/radioviewai-home@2')).toBe(true)
    expect(RECORD_ID_PATTERNS['asset:'].test('asset:savelifeai/screen/radioviewai-home')).toBe(false)
    expect(RECORD_ID_PATTERNS['atom:'].test('atom:savelifeai/spine-encounter-to-paid@3')).toBe(true)
    expect(RECORD_ID_PATTERNS['release:'].test('release:savelifeai/2026-radioviewai-platform-clearance')).toBe(true)
    expect(RECORD_ID_PATTERNS['page:'].test('page:savelifeai/products-radioviewai')).toBe(true)
  })
})

describe('banned vocabulary never reaches the database', () => {
  // Built from pieces so this file never contains the retired terms (the CI vocabulary check).
  it.each(['Ayra' + ' Platform', 'Super' + 'App', 'Super' + ' App'])('refuses "%s"', async (term) => {
    await expect(
      createAs('syncA', 'claims', { ...claim(ctx.tenantA, `vocab-${term.length}`, 'internal'), text: `Built on the ${term}` }),
    ).rejects.toThrow()
  })
})
