import type { CollectionSlug } from 'payload'

import { as, type Session } from './access'

/** Collections shown per site, in the order the control room lists them. */
export const SITE_COLLECTIONS: { slug: CollectionSlug; label: string }[] = [
  { slug: 'pages', label: 'Pages' },
  { slug: 'posts', label: 'Posts' },
  { slug: 'claims', label: 'Claims' },
  { slug: 'atoms', label: 'Atoms' },
  { slug: 'media', label: 'Assets' },
  { slug: 'products', label: 'Products' },
  { slug: 'whats-new', label: 'What’s New' },
]

export type Receipt = {
  id: number | string
  receiptId: string
  revision: number
  status: 'ok' | 'failed'
  actor: string
  finishedAt: string
  counts?: { create: number; update: number; unchanged: number }
  orphans?: { collection: string; recordId: string }[]
  error?: string | null
}

export type Attention = { level: 'bad' | 'warn'; text: string; href?: string }

export type SiteSummary = {
  id: number | string
  slug: string
  name: string
  domain?: string
  status: string // site.yaml status, or "no settings yet"
  counts: Record<string, number>
  lastReceipt?: Receipt
  attention: Attention[]
}

const today = () => new Date().toISOString().slice(0, 10)

export async function sitesFor(s: Session): Promise<{ id: number | string; slug: string; name: string }[]> {
  const { docs } = await s.payload.find({ collection: 'tenants', ...as(s), limit: 50, depth: 0, sort: 'name' })
  return docs.map((t) => ({ id: t.id, slug: String(t.slug), name: String(t.name) }))
}

export async function siteSummary(s: Session, site: { id: number | string; slug: string; name: string }): Promise<SiteSummary> {
  const inSite = { tenant: { equals: site.id } }
  const counts: Record<string, number> = {}
  await Promise.all(
    SITE_COLLECTIONS.map(async ({ slug }) => {
      counts[slug] = (await s.payload.count({ collection: slug, ...as(s), where: inSite })).totalDocs
    }),
  )
  const [settings] = (await s.payload.find({ collection: 'site-settings', ...as(s), where: inSite, limit: 1, depth: 0 })).docs as unknown as {
    status?: string
    domains?: { primary?: string }
  }[]
  const [lastReceipt] = (await s.payload.find({
    collection: 'sync-receipts', ...as(s), where: inSite, sort: '-revision', limit: 1, depth: 0,
  })).docs as unknown as Receipt[]

  const attention: Attention[] = []
  if (lastReceipt?.status === 'failed') {
    attention.push({ level: 'bad', text: `Last sync failed (revision ${lastReceipt.revision})`, href: `/receipts/${lastReceipt.id}` })
  }
  const orphans = lastReceipt?.orphans?.length ?? 0
  if (orphans) attention.push({ level: 'warn', text: `${orphans} record${orphans === 1 ? '' : 's'} no longer in _ops`, href: `/receipts/${lastReceipt!.id}` })
  const overdue = (await s.payload.count({
    collection: 'pages', ...as(s),
    where: { and: [inSite, { status: { equals: 'approved' } }, { reviewBy: { less_than: today() } }] },
  })).totalDocs
  if (overdue) attention.push({ level: 'warn', text: `${overdue} page${overdue === 1 ? '' : 's'} past review date`, href: `/sites/${site.slug}?tab=pages` })

  return {
    ...site,
    domain: settings?.domains?.primary,
    status: settings?.status ?? 'no settings yet',
    counts,
    lastReceipt,
    attention,
  }
}

export const when = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return d.toISOString().slice(0, 10)
}
