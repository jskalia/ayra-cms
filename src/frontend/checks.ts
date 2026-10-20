import type { CollectionSlug } from 'payload'

import { as, type Session } from './access'
import { citesOf } from './references'

/**
 * 9.6 · Health checks for one site, read with the signed-in person's permissions.
 * They catch what the write-time rules cannot: something changing AFTER a page was approved
 * (a cited claim made internal, a product unreleased, an asset retired), review dates passing,
 * records left behind in the site, and failed syncs.
 */
export type Issue = {
  check: 'public-cites' | 'review-date' | 'approval' | 'orphans' | 'sync-failed' | 'not-synced'
  level: 'bad' | 'warn' | 'info'
  text: string
  href?: string
}

type Doc = Record<string, any>
type Site = { id: number | string; slug: string; name: string }

const LIVE: Record<string, { collection: CollectionSlug; live: (d: Doc) => boolean; label: (d: Doc) => string }> = {
  pages: { collection: 'pages', live: (d) => d.status === 'approved' && d.visibility === 'public', label: (d) => d.route },
  posts: { collection: 'posts', live: (d) => d.status === 'approved' && d.visibility === 'public', label: (d) => d.title },
  atoms: { collection: 'atoms', live: (d) => d.status === 'active' && d.visibility === 'public', label: (d) => d.recordId },
  'whats-new': { collection: 'whats-new', live: (d) => ['approved', 'published'].includes(d.status) && d.visibility === 'public', label: (d) => d.recordId },
}

export async function runChecks(s: Session, site: Site, today = new Date().toISOString().slice(0, 10)): Promise<Issue[]> {
  const issues: Issue[] = []
  const inSite = { tenant: { equals: site.id } }

  // 1. Public, live records whose citations are missing or no longer public.
  for (const [key, def] of Object.entries(LIVE)) {
    const { docs } = await s.payload.find({ collection: def.collection, ...as(s), depth: 0, limit: 1000, pagination: false, where: inSite })
    for (const d of (docs as Doc[]).filter(def.live)) {
      for (const c of await citesOf(s, site.id, key, d)) {
        if (!c.found || !c.isPublic) {
          issues.push({
            check: 'public-cites', level: 'bad', href: `/records/${key}/${d.id}`,
            text: `${def.label(d)} (public) cites ${c.ref}, which is ${c.found ? 'no longer public' : 'missing from the site'}`,
          })
        }
      }
    }
  }

  // 2. Approved pages past their review date (completeness area 3).
  const overdue = await s.payload.find({
    collection: 'pages', ...as(s), depth: 0, limit: 500, pagination: false,
    where: { and: [inSite, { status: { equals: 'approved' } }, { reviewBy: { less_than: today } }] },
  })
  for (const p of overdue.docs as Doc[]) {
    issues.push({ check: 'review-date', level: 'warn', href: `/records/pages/${p.id}`, text: `${p.route} was due for review on ${p.reviewBy}` })
  }

  // 3. Approved pages or posts without a recorded approval (who and when).
  for (const collection of ['pages', 'posts'] as const) {
    const { docs } = await s.payload.find({
      collection, ...as(s), depth: 0, limit: 500, pagination: false, where: { and: [inSite, { status: { equals: 'approved' } }] },
    })
    for (const d of docs as Doc[]) {
      if (!d.approved?.by || !d.approved?.at) {
        issues.push({ check: 'approval', level: 'bad', href: `/records/${collection}/${d.id}`, text: `${d.route ?? d.title} is approved but has no recorded approver` })
      }
    }
  }

  // 4 and 5. The last sync: failed, or records no longer in _ops.
  const [last] = (await s.payload.find({ collection: 'sync-receipts', ...as(s), depth: 0, limit: 1, sort: '-revision', where: inSite })).docs as Doc[]
  if (!last) {
    issues.push({ check: 'not-synced', level: 'info', text: 'This site has never been synced' })
  } else {
    if (last.status === 'failed') {
      issues.push({ check: 'sync-failed', level: 'bad', href: `/receipts/${last.id}`, text: `The last sync (rev ${last.revision}) failed: ${last.error ?? 'see the receipt'}` })
    }
    for (const o of (last.orphans ?? []) as Doc[]) {
      issues.push({ check: 'orphans', level: 'warn', href: `/receipts/${last.id}`, text: `${o.recordId} (${o.collection}) is in the site but no longer in _ops` })
    }
  }
  return issues
}
