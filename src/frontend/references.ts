import path from 'node:path'
import type { CollectionSlug } from 'payload'

import { collectRefs } from '../hooks/pageReferences'
import { as, type Session } from './access'

type Doc = Record<string, any>

/** The fields of each collection that may hold citations (the same ones the CMS checks). */
export const citingFields: Record<string, (d: Doc) => unknown[]> = {
  pages: (d) => [d.product, d.blocks, d.seo, d.body],
  posts: (d) => [d.heroAsset, d.cites, d.seo, d.body],
  atoms: (d) => [d.claims, d.assets, d.shape],
  'whats-new': (d) => [d.product, d.whatShipped, d.regulated, d.assets],
}
const KIND: Record<string, { collection: CollectionSlug; isPublic: (d: Doc) => boolean }> = {
  claim: { collection: 'claims', isPublic: (d) => d.visibility === 'public' && d.status === 'active' },
  atom: { collection: 'atoms', isPublic: (d) => d.visibility === 'public' && d.status === 'active' },
  asset: { collection: 'media', isPublic: (d) => d.status === 'approved' },
  product: { collection: 'products', isPublic: (d) => d.released === true },
}

export type ResolvedRef = { ref: string; found: boolean; isPublic: boolean; href?: string }

/** What a record cites, each checked against the site right now. */
export async function citesOf(s: Session, tenant: number | string, collection: string, doc: Doc): Promise<ResolvedRef[]> {
  const pick = citingFields[collection]
  if (!pick) return []
  const refs = [...collectRefs(pick(doc))].sort()
  return Promise.all(
    refs.map(async (ref) => {
      const kind = KIND[ref.split(':')[0]]
      if (!kind) return { ref, found: false, isPublic: false }
      const { docs } = await s.payload.find({
        collection: kind.collection, ...as(s), depth: 0, limit: 1,
        where: { and: [{ tenant: { equals: tenant } }, { recordId: { equals: ref } }] },
      })
      const target = docs[0] as Doc | undefined
      return { ref, found: Boolean(target), isPublic: target ? kind.isPublic(target) : false, href: target ? `/records/${kind.collection}/${target.id}` : undefined }
    }),
  )
}

/** Which pages, posts, atoms and What's New entries of the site cite this record. */
export async function citedBy(s: Session, tenant: number | string, recordId: string) {
  const out: { collection: string; id: number | string; label: string }[] = []
  for (const collection of Object.keys(citingFields)) {
    const { docs } = await s.payload.find({
      collection: collection as CollectionSlug, ...as(s), depth: 0, limit: 1000, pagination: false,
      where: { tenant: { equals: tenant } },
    })
    for (const d of docs as Doc[]) {
      if (collectRefs(citingFields[collection](d)).has(recordId)) {
        out.push({ collection, id: d.id, label: d.route ?? d.title ?? d.recordId })
      }
    }
  }
  return out
}

/** The sync receipts that created or changed this record, newest first. */
export async function historyOf(s: Session, tenant: number | string, collection: string, recordId: string) {
  const { docs } = await s.payload.find({
    collection: 'sync-receipts', ...as(s), depth: 0, limit: 200, sort: '-revision', where: { tenant: { equals: tenant } },
  })
  return (docs as Doc[])
    .map((r) => ({ r, item: (r.items ?? []).find((i: Doc) => i.collection === collection && i.recordId === recordId) }))
    .filter((x) => x.item && x.item.action !== 'unchanged')
    .map(({ r, item }) => ({ id: r.id, receiptId: r.receiptId, revision: r.revision, finishedAt: r.finishedAt, actor: r.actor, action: item.action }))
}

/**
 * A link to the record's source file in the AyraAgent Files view. SOURCE_FILES_URL_TEMPLATE
 * (env, not in git) holds the workspace address with a {path} placeholder; the path is
 * _ops/<org folder>/<path inside it>, the org folder taken from the site's last receipt.
 */
export async function sourceLink(s: Session, tenant: number | string, sourcePath?: string) {
  if (!sourcePath) return undefined
  const { docs } = await s.payload.find({
    collection: 'sync-receipts', ...as(s), depth: 0, limit: 1, sort: '-revision', where: { tenant: { equals: tenant } },
  })
  const org = docs[0] ? path.basename(String((docs[0] as Doc).sourceRoot ?? '')) : ''
  const full = org ? `_ops/${org}/${sourcePath}` : sourcePath
  const template = process.env.SOURCE_FILES_URL_TEMPLATE
  return { path: full, href: template ? template.replace('{path}', encodeURIComponent(full)) : undefined }
}
