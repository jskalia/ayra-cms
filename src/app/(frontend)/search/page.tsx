import Link from 'next/link'
import type { CollectionSlug } from 'payload'

import { TABS } from '../../../frontend/columns'
import { SITE_COLLECTIONS, sitesFor } from '../../../frontend/data'
import { as, requireSession } from '../../../frontend/session'
import { Shell } from '../../../frontend/Shell'

export const metadata = { title: 'Search' }

type Doc = Record<string, any>

/** 9.7 · One search across every record kind of the sites this person may see. */
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? ''
  const session = await requireSession(`/search${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  const sites = await sitesFor(session)
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
      <header className="cr-head">
        <h1>Search</h1>
        {q && <p className="cr-sub">{found} result{found === 1 ? '' : 's'} for “{q}”</p>}
      </header>
      <form className="cr-filters" action="/search" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Record id, title, route, claim text…" aria-label="Search all sites" autoFocus />
        <button type="submit">Search</button>
      </form>
      {q.length > 0 && q.length < 2 && <p className="cr-empty">Type at least two characters.</p>}
      {q.length >= 2 && found === 0 && <p className="cr-empty">Nothing matches “{q}” in the sites you can see.</p>}
      <div className="cr-checks">
        {groups
          .filter((g) => g.docs.length > 0)
          .map((g) => (
            <section className="cr-panel" key={g.slug} aria-labelledby={`s-${g.slug}`}>
              <h2 id={`s-${g.slug}`}>
                {g.label} · {g.totalDocs}
              </h2>
              <ul className="cr-list">
                {g.docs.map((d) => (
                  <li key={d.id}>
                    <Link href={`/records/${g.slug}/${d.id}`}>{g.def.title(d)}</Link>{' '}
                    <span className="cr-small">
                      {siteName.get(String(typeof d.tenant === 'object' ? d.tenant?.id : d.tenant)) ?? ''}
                      {d.recordId && g.def.title(d) !== d.recordId ? ` · ${d.recordId}` : ''}
                    </span>
                  </li>
                ))}
                {g.totalDocs > g.docs.length && <li className="cr-small">…and {g.totalDocs - g.docs.length} more; narrow the search.</li>}
              </ul>
            </section>
          ))}
      </div>
    </Shell>
  )
}
