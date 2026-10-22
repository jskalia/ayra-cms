import type { Where } from 'payload'

import { as, type Session } from './access'

/** The blog inbox (Phase 12): AyraAgent blogs by where they stand. */
export const BLOG_TABS = [
  { key: 'pending', label: 'Needs approval' },
  { key: 'sent-back', label: 'Sent back' },
  { key: 'live', label: 'Live' },
  { key: 'retired', label: 'Retired' },
] as const
export type BlogTab = (typeof BLOG_TABS)[number]['key']
export const isBlogTab = (v: unknown): v is BlogTab => BLOG_TABS.some((t) => t.key === v)

const FROM_AYRA: Where = { origin: { equals: 'ayra-blogs' } }
const TAB_WHERE: Record<BlogTab, Where> = {
  pending: { and: [{ status: { equals: 'draft' } }, { 'review.state': { not_equals: 'sent-back' } }] },
  'sent-back': { and: [{ status: { equals: 'draft' } }, { 'review.state': { equals: 'sent-back' } }] },
  live: { status: { equals: 'approved' } },
  retired: { status: { equals: 'retired' } },
}
export const blogWhere = (tab: BlogTab, siteId?: number | string): Where => ({
  and: [FROM_AYRA, TAB_WHERE[tab], ...(siteId !== undefined ? [{ tenant: { equals: siteId } }] : [])],
})

export async function blogCounts(s: Session, siteId?: number | string): Promise<Record<BlogTab, number>> {
  const counts = await Promise.all(
    BLOG_TABS.map(async ({ key }) => [key, (await s.payload.count({ collection: 'posts', ...as(s), where: blogWhere(key, siteId) })).totalDocs] as const),
  )
  return Object.fromEntries(counts) as Record<BlogTab, number>
}

/** How many blogs wait for a decision, for the sidebar (0 if it cannot be read). */
export async function pendingBlogs(s: Session): Promise<number> {
  try {
    return (await s.payload.count({ collection: 'posts', ...as(s), where: blogWhere('pending') })).totalDocs
  } catch {
    return 0
  }
}

export type BlogRow = {
  id: number | string
  title: string
  excerpt?: string | null
  tenant: unknown
  status: string
  slug: string
  bodyMarkdown?: string | null
  updatedAt: string
  sync?: { syncedAt?: string | null } | null
  sources?: unknown
  review?: { state?: string | null; previouslyApproved?: boolean | null; decidedBy?: string | null; decidedAt?: string | null } | null
}

export async function blogRows(s: Session, tab: BlogTab, siteId?: number | string): Promise<BlogRow[]> {
  const { docs } = await s.payload.find({
    collection: 'posts', ...as(s), depth: 0, limit: 50, sort: '-updatedAt', where: blogWhere(tab, siteId),
    select: { title: true, excerpt: true, tenant: true, status: true, slug: true, bodyMarkdown: true, updatedAt: true, sync: true, sources: true, review: true },
  })
  return docs as unknown as BlogRow[]
}

export const wordCount = (markdown?: string | null) => (markdown ?? '').split(/\s+/).filter(Boolean).length
export const sourceCount = (sources: unknown) => (Array.isArray(sources) ? sources.length : 0)

export type Check = { tone: 'ok' | 'warn' | 'bad'; text: string }

/** What a reader should know before approving: computed from the post, nothing is guessed. */
export function reviewChecks(doc: {
  author?: { name?: string | null } | null
  excerpt?: string | null
  seo?: { description?: string | null; canonical?: string | null } | null
  bodyMarkdown?: string | null
  sources?: unknown
}): Check[] {
  const words = wordCount(doc.bodyMarkdown)
  const checks: Check[] = []
  checks.push(doc.author?.name ? { tone: 'ok', text: `Written by ${doc.author.name}` } : { tone: 'bad', text: 'No author set for this site (needed to approve)' })
  checks.push(words >= 200 ? { tone: 'ok', text: `${words.toLocaleString('en')} words` } : { tone: 'warn', text: `Short: ${words} words` })
  checks.push(doc.excerpt ? { tone: 'ok', text: 'Has a summary' } : { tone: 'warn', text: 'No summary for listings' })
  checks.push(doc.seo?.description ? { tone: 'ok', text: 'Has a search description' } : { tone: 'warn', text: 'No search description' })
  const n = sourceCount(doc.sources)
  checks.push(n ? { tone: 'ok', text: `${n} source${n === 1 ? '' : 's'} cited` } : { tone: 'warn', text: 'No sources cited' })
  if (/\]\(http:\/\//i.test(doc.bodyMarkdown ?? '')) checks.push({ tone: 'warn', text: 'Has links that are not https' })
  return checks
}

export const STATE_LABEL = (status: string, state?: string | null) =>
  status === 'approved' ? 'Live' : status === 'retired' ? 'Retired' : state === 'sent-back' ? 'Sent back' : 'Needs approval'
