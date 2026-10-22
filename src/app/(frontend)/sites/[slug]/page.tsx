import { Download, Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CollectionSlug, Where } from 'payload'

import { ABOUT, SITE_INTRO, SITE_INTRO_EMPTY } from '../../../../frontend/about'
import { SORTS, TABS } from '../../../../frontend/columns'
import { SITE_COLLECTIONS, siteSummary, sitesWithStatus, when } from '../../../../frontend/data'
import { as, requireSession } from '../../../../frontend/session'
import { Shell } from '../../../../frontend/Shell'
import { Button, ButtonLink, Card, cn, EmptyState, fieldClass, Mono, PageHeader, Pager, SortTh, StatusBadge, Table, Td, Th, toneOf, Tr } from '../../../../frontend/ui'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }

const NAMES: Record<string, string> = {
  savelifeai: 'SaveLife.AI', junaidkalia: 'Junaid Kalia', signalandsymptoms: 'Signal & Symptoms', ayraagent: 'AyraAgent', heyayraai: 'HeyAyra',
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  return { title: NAMES[slug] ?? slug }
}

/** 9.3 / 10.4 · Site view: every record kind of one site, with filters, search, sorting and paging. */
export default async function SitePage({ params, searchParams }: Props) {
  const { slug } = await params
  const query = await searchParams
  const session = await requireSession(`/sites/${slug}`)
  const sites = await sitesWithStatus(session)
  const site = sites.find((s) => s.slug === slug)
  if (!site) notFound() // not a site this person may see
  const summary = await siteSummary(session, site)
  // Admins can pull this site's published AyraAgent blogs now (src/sync/blogs.ts).
  const tenantDoc = session.isAdmin
    ? ((await session.payload.findByID({ collection: 'tenants', id: site.id, ...as(session), depth: 0 })) as { ayraBlogs?: { org?: string | null } })
    : undefined
  const blogsOrg = tenantDoc?.ayraBlogs?.org || undefined

  // Only kinds that hold records are listed (Posts always, for blogs); the rest appear once the sync brings them.
  const shown = SITE_COLLECTIONS.filter((c) => c.slug === 'posts' || summary.counts[c.slug] > 0)
  const firstWithRecords = shown.find((c) => summary.counts[c.slug] > 0)?.slug ?? 'posts'
  const tab = (shown.find((c) => c.slug === query.tab)?.slug ?? firstWithRecords) as string
  const def = TABS[tab]
  const sorts = SORTS[tab] ?? {}
  const sort = Object.values(sorts).some((f) => query.sort === f || query.sort === `-${f}`) ? query.sort : undefined
  const and: Where[] = [{ tenant: { equals: site.id } }]
  for (const f of def.filters) {
    const v = query[f.field]
    if (v && f.options.includes(v)) and.push({ [f.field]: { equals: v === 'true' ? true : v === 'false' ? false : v } })
  }
  const q = query.q?.trim()
  if (q) and.push({ or: def.searchFields.map((field) => ({ [field]: { like: q } })) })
  const page = Math.max(1, Number(query.page) || 1)
  const result = await session.payload.find({
    collection: tab as CollectionSlug, ...as(session), where: { and }, limit: 50, page, depth: 1, sort,
  })
  const filtered = Boolean(q || def.filters.some((f) => query[f.field]))

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...query, ...patch })) if (v) next.set(k, v)
    return `/sites/${slug}?${next.toString()}`
  }
  const linkCol = def.columns[0].label === '' ? 1 : 0

  return (
    <Shell session={session} sites={sites} active={`/sites/${slug}`}>
      <PageHeader
        crumbs={[{ href: '/overview', label: 'Overview' }, { label: 'Sites' }]}
        title={site.name}
        sub={shown.some((c) => c.slug !== 'posts') ? SITE_INTRO : SITE_INTRO_EMPTY}
        meta={
          <>
            <StatusBadge value={summary.status} tone={toneOf(summary.status)} />
            {summary.domain && <span>{summary.domain}</span>}
            <span>
              {summary.lastReceipt ? (
                <>
                  last sync {when(summary.lastReceipt.finishedAt)} · <Mono>rev {summary.lastReceipt.revision}</Mono>
                </>
              ) : (
                'never synced'
              )}
            </span>
          </>
        }
        actions={
          <>
            {blogsOrg && (
              <form action={`/sites/${slug}/import-blogs`} method="post">
                <Button type="submit" size="sm" variant="primary" title={`Import published blogs from AyraAgent org ${blogsOrg}`}>
                  <Download className="size-3.5" aria-hidden /> Import from AyraAgent
                </Button>
              </form>
            )}
            <ButtonLink href={`/receipts?site=${slug}`} size="sm">Receipts</ButtonLink>
            <ButtonLink href="/checks" size="sm">Checks</ButtonLink>
          </>
        }
      />

      {query.import && (
        <p role="status" className={cn('cr-rise mb-4 rounded-[12px] border px-4 py-2.5 text-[13px]', query.import.startsWith('problem') || query.import === 'not-configured' ? 'border-bad/30 bg-bad-soft' : 'border-ok/30 bg-ok-soft')}>
          <b>AyraAgent import:</b> {query.import === 'not-configured' ? 'this site has no AyraAgent org set.' : query.import}
        </p>
      )}

      <nav aria-label="Record kinds" className="cr-scroll cr-rise -mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
        {shown.map((c) => {
          const current = c.slug === tab
          return (
            <Link
              key={c.slug}
              href={`/sites/${slug}?tab=${c.slug}`}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors',
                current ? 'border-accent-fill bg-accent-fill text-accent-fg' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text',
                !current && !summary.counts[c.slug] && 'opacity-60',
              )}
            >
              {c.label}
              <span className={cn('font-mono text-[11px]', current ? 'text-accent-fg/80' : 'text-faint')}>{summary.counts[c.slug]}</span>
            </Link>
          )
        })}
      </nav>

      <Card i={1}>
        {ABOUT[tab] && (
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 border-b border-border bg-surface-2/40 px-4 py-3 text-[13px]">
            <p className="max-w-[78ch] text-muted">
              <span className="font-semibold text-text">{SITE_COLLECTIONS.find((c) => c.slug === tab)?.label}.</span> {ABOUT[tab].what} <span className="text-faint">{ABOUT[tab].from}</span>
            </p>
            {ABOUT[tab].link && (
              <Link href={ABOUT[tab].link!.href(slug)} className="font-semibold whitespace-nowrap text-accent hover:underline">
                {ABOUT[tab].link!.label} →
              </Link>
            )}
          </div>
        )}
        <form action={`/sites/${slug}`} className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <input type="hidden" name="tab" value={tab} />
          {sort && <input type="hidden" name="sort" value={sort} />}
          <label className="relative min-w-[200px] flex-1 sm:max-w-[360px]">
            <span className="sr-only">Search this tab</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
            <input type="search" name="q" defaultValue={q} placeholder={`Search ${def.searchFields.join(', ')}`} className={cn(fieldClass, 'w-full pl-8')} />
          </label>
          {def.filters.map((f) => (
            <select key={f.field} name={f.field} defaultValue={query[f.field] ?? ''} aria-label={f.label} className={cn(fieldClass, 'pr-7')}>
              <option value="">{f.label}: any</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ))}
          <Button type="submit" variant="primary" size="md">
            <SlidersHorizontal className="size-3.5" aria-hidden /> Apply
          </Button>
          {filtered && (
            <ButtonLink href={`/sites/${slug}?tab=${tab}`} variant="ghost">
              Clear
            </ButtonLink>
          )}
          <span className="ml-auto text-[12px] text-muted">
            <Mono>{result.totalDocs}</Mono> {result.totalDocs === 1 ? 'record' : 'records'}
          </span>
        </form>

        {result.docs.length === 0 ? (
          <EmptyState title={filtered ? 'Nothing matches these filters' : 'Nothing here yet'}>
            {filtered ? 'Try fewer filters, or clear them.' : tab === 'posts' ? 'No posts yet. Blogs from AyraAgent show up here, and in the Blogs inbox where you approve them.' : `Nothing has arrived yet. ${ABOUT[tab]?.from ?? 'Records of this kind arrive with the next sync from _ops.'}`}
          </EmptyState>
        ) : (
          <>
            <Table className="max-h-[70vh]">
              <thead>
                <tr>
                  {def.columns.map((c, i) =>
                    sorts[c.label] ? (
                      <SortTh key={i} label={c.label} field={sorts[c.label]} current={sort} href={(s) => href({ sort: s, page: undefined })} />
                    ) : (
                      <Th key={i}>{c.label || <span className="sr-only">Preview</span>}</Th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {result.docs.map((doc) => {
                  const r = doc as Record<string, any>
                  return (
                    <Tr key={r.id}>
                      {def.columns.map((c, i) => (
                        <Td key={i} mono={c.mono}>
                          {i === linkCol ? (
                            <Link href={`/records/${tab}/${r.id}`} className="font-semibold text-text hover:text-accent">
                              {c.cell(r)}
                            </Link>
                          ) : (
                            c.cell(r)
                          )}
                        </Td>
                      ))}
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <Pager page={page} totalPages={result.totalPages} totalDocs={result.totalDocs} href={(p) => href({ page: String(p) })} />
          </>
        )}
      </Card>
    </Shell>
  )
}
