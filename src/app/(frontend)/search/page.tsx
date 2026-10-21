import { Search as SearchIcon } from 'lucide-react'
import Link from 'next/link'
import type { CollectionSlug } from 'payload'

import { TABS } from '../../../frontend/columns'
import { SITE_COLLECTIONS, sitesWithStatus } from '../../../frontend/data'
import { as, requireSession } from '../../../frontend/session'
import { Shell } from '../../../frontend/Shell'
import { Button, Card, CardHeader, cn, EmptyState, fieldClass, Mono, PageHeader, StatusBadge } from '../../../frontend/ui'

export const metadata = { title: 'Search' }

type Doc = Record<string, any>

/** 9.7 · One search across every record kind of the sites this person may see. */
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? ''
  const session = await requireSession(`/search${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  const sites = await sitesWithStatus(session)
  const siteName = new Map(sites.map((s) => [String(s.id), s.name]))

  const groups =
    q.length >= 2
      ? await Promise.all(
          SITE_COLLECTIONS.map(async (c) => {
            const def = TABS[c.slug]
            const { docs, totalDocs } = await session.payload.find({
              collection: c.slug as CollectionSlug, ...as(session), depth: 0, limit: 20,
              where: { or: def.searchFields.map((field) => ({ [field]: { like: q } })) },
            })
            return { ...c, def, docs: docs as Doc[], totalDocs }
          }),
        )
      : []
  const found = groups.reduce((n, g) => n + g.totalDocs, 0)

  return (
    <Shell session={session} sites={sites} active="/search">
      <PageHeader title="Search" sub={q.length >= 2 ? `${found} result${found === 1 ? '' : 's'} for “${q}”` : 'Every record kind, across every site you can see.'} />
      <form action="/search" role="search" className="cr-rise mb-6 flex gap-2">
        <label className="relative flex-1 sm:max-w-[560px]">
          <span className="sr-only">Search all sites</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input type="search" name="q" defaultValue={q} placeholder="Record id, title, route, claim text…" autoFocus className={cn(fieldClass, 'h-11 w-full pl-10 text-[14px]')} />
        </label>
        <Button type="submit" variant="primary" className="h-11 px-5">
          Search
        </Button>
      </form>

      {q.length > 0 && q.length < 2 && <p className="text-[13.5px] text-muted">Type at least two characters.</p>}
      {q.length >= 2 && found === 0 && (
        <Card i={1}>
          <EmptyState title={`Nothing matches “${q}”`} icon={<SearchIcon />}>
            Only the sites your account can see are searched. Try a record id such as claim:… or a page route.
          </EmptyState>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups
          .filter((g) => g.docs.length > 0)
          .map((g, n) => (
            <Card key={g.slug} i={1 + n} aria-labelledby={`s-${g.slug}`}>
              <CardHeader id={`s-${g.slug}`} title={g.label} count={g.totalDocs} />
              <ul className="px-2 pb-2">
                {g.docs.map((d) => (
                  <li key={d.id}>
                    <Link href={`/records/${g.slug}/${d.id}`} className="flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-surface-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{g.def.title(d)}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {siteName.get(String(typeof d.tenant === 'object' ? d.tenant?.id : d.tenant)) ?? ''}
                          {d.recordId && g.def.title(d) !== d.recordId ? (
                            <>
                              {' · '}
                              <Mono className="text-[11.5px]">{d.recordId}</Mono>
                            </>
                          ) : null}
                        </span>
                      </span>
                      {d.status && <StatusBadge value={d.status} />}
                    </Link>
                  </li>
                ))}
                {g.totalDocs > g.docs.length && <li className="px-2 py-2 text-[12.5px] text-muted">…and {g.totalDocs - g.docs.length} more; narrow the search.</li>}
              </ul>
            </Card>
          ))}
      </div>
    </Shell>
  )
}
