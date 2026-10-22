import { ArrowRight, CheckCircle2, Inbox, RefreshCw, TriangleAlert } from 'lucide-react'
import Link from 'next/link'

import { BLOG_TABS, blogCounts, blogRows, isBlogTab, sourceCount, wordCount, type BlogTab } from '../../frontend/blogs'
import { sitesWithStatus, when } from '../../frontend/data'
import { requireSession } from '../../frontend/session'
import { Shell } from '../../frontend/Shell'
import { Badge, Button, Card, cn, EmptyState, PageHeader } from '../../frontend/ui'

export const metadata = { title: 'Blogs' }

type Props = { searchParams: Promise<Record<string, string | undefined>> }

const EMPTY: Record<BlogTab, { title: string; text: string }> = {
  pending: { title: 'Nothing waiting for you', text: 'When AyraAgent publishes a blog for one of your sites, it shows up here to read and approve.' },
  'sent-back': { title: 'Nothing sent back', text: 'Blogs you send back wait here until AyraAgent publishes a new version.' },
  live: { title: 'No live blogs yet', text: 'Approved blogs appear here, and on the website at its next deploy.' },
  retired: { title: 'No retired blogs', text: 'A blog archived in AyraAgent is hidden from the website and listed here.' },
}

/** 12.3 · Home: the blog inbox. AyraAgent writes the blogs; people read, preview and approve them here. */
export default async function Blogs({ searchParams }: Props) {
  const query = await searchParams
  const session = await requireSession('/')
  const sites = await sitesWithStatus(session)
  const site = sites.find((s) => s.slug === query.site)
  const tab: BlogTab = isBlogTab(query.tab) ? query.tab : 'pending'
  const [counts, rows] = await Promise.all([blogCounts(session, site?.id), blogRows(session, tab, site?.id)])
  const siteName = new Map(sites.map((s) => [String(s.id), s.name]))

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries({ tab: tab === 'pending' ? undefined : tab, site: site?.slug, ...patch })) if (v) next.set(k, v)
    const qs = next.toString()
    return qs ? `/?${qs}` : '/'
  }
  const importMessage = query.import?.slice(0, 300)

  return (
    <Shell session={session} sites={sites} active="/">
      <PageHeader
        title="Blogs"
        sub="AyraAgent writes them. A person reads and approves them here."
        actions={
          session.isAdmin && (
            <form action="/blogs/import" method="post">
              {site && <input type="hidden" name="site" value={site.slug} />}
              <Button type="submit" variant="secondary">
                <RefreshCw className="size-3.5" aria-hidden /> Import now{site ? ` · ${site.name}` : ''}
              </Button>
            </form>
          )
        }
      />

      {importMessage && (
        <p role="status" className="cr-rise mb-4 flex items-center gap-2 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px]">
          {importMessage.startsWith('problem') ? <TriangleAlert className="size-4 text-warn" aria-hidden /> : <CheckCircle2 className="size-4 text-ok" aria-hidden />}
          {importMessage === 'not-configured' ? 'No site has an AyraAgent organization set yet. Set one under the site’s settings in Accounts and keys.' : importMessage}
        </p>
      )}

      {sites.length > 1 && (
        <nav aria-label="Filter by site" className="cr-rise mb-3 flex flex-wrap items-center gap-1.5">
          {[{ slug: undefined, name: 'All sites' }, ...sites].map((s) => {
            const on = (s.slug ?? undefined) === site?.slug
            return (
              <Link
                key={s.slug ?? 'all'}
                href={href({ site: s.slug, tab: tab === 'pending' ? undefined : tab })}
                aria-current={on ? 'true' : undefined}
                className={cn('h-8 rounded-full border px-3 text-[12.5px] leading-[30px] font-medium transition-colors', on ? 'border-accent-fill bg-accent-soft text-accent' : 'border-border text-muted hover:border-border-strong hover:text-text')}
              >
                {s.name}
              </Link>
            )
          })}
        </nav>
      )}

      <Card i={1} className="overflow-hidden">
        <nav aria-label="Blog status" className="flex gap-1 overflow-x-auto border-b border-border px-3">
          {BLOG_TABS.map(({ key, label }) => {
            const on = key === tab
            return (
              <Link
                key={key}
                href={href({ tab: key === 'pending' ? undefined : key })}
                aria-current={on ? 'page' : undefined}
                className={cn('-mb-px flex h-11 items-center gap-2 border-b-2 px-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors', on ? 'border-accent-fill text-text' : 'border-transparent text-muted hover:text-text')}
              >
                {label}
                <span className={cn('rounded-full px-1.5 font-mono text-[11px] leading-5 font-semibold', key === 'pending' && counts[key] > 0 ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-faint')}>{counts[key]}</span>
              </Link>
            )
          })}
        </nav>

        {rows.length === 0 ? (
          <EmptyState title={EMPTY[tab].title} icon={<Inbox />}>
            {EMPTY[tab].text}
          </EmptyState>
        ) : (
          <ul>
            {rows.map((r) => {
              const edited = tab === 'pending' && r.review?.previouslyApproved
              const arrived = r.sync?.syncedAt ?? r.updatedAt
              return (
                <li key={r.id} className="border-b border-border last:border-b-0">
                  <Link href={`/blogs/${r.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2/60">
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-semibold group-hover:text-accent">{r.title}</p>
                      {r.excerpt && <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{r.excerpt}</p>}
                      <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-faint">
                        <Badge tone="accent">{siteName.get(String(typeof r.tenant === 'object' && r.tenant ? (r.tenant as { id: unknown }).id : r.tenant)) ?? 'Site'}</Badge>
                        <span>{tab === 'live' ? `Approved ${r.review?.decidedAt ?? ''}` : `Arrived ${when(arrived)}`}</span>
                        <span aria-hidden>·</span>
                        <span>{sourceCount(r.sources)} sources</span>
                        <span aria-hidden>·</span>
                        <span>{wordCount(r.bodyMarkdown).toLocaleString('en')} words</span>
                        {edited && <Badge tone="warn">edited after approval</Badge>}
                        {tab === 'sent-back' && r.review?.decidedBy && <span>sent back by {r.review.decidedBy}</span>}
                      </p>
                    </div>
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-border px-3 text-[12.5px] font-semibold text-muted group-hover:border-border-strong group-hover:text-text">
                      {tab === 'pending' ? 'Review' : 'Open'} <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-[12.5px] text-faint">
        Looking for pages, claims, receipts or checks?{' '}
        <Link href="/overview" className="font-semibold text-accent hover:underline">
          Open the overview
        </Link>
      </p>
    </Shell>
  )
}
