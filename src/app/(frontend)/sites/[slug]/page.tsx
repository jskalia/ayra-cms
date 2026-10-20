import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CollectionSlug, Where } from 'payload'

import { TABS } from '../../../../frontend/columns'
import { SITE_COLLECTIONS, siteSummary, sitesFor, when } from '../../../../frontend/data'
import { as, requireSession } from '../../../../frontend/session'
import { Shell } from '../../../../frontend/Shell'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }

const NAMES: Record<string, string> = {
  savelifeai: 'SaveLife.AI', junaidkalia: 'Junaid Kalia', signalandsymptoms: 'Signal & Symptoms', ayraagent: 'AyraAgent', heyayraai: 'HeyAyra',
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  return { title: NAMES[slug] ?? slug }
}

/** 9.3 · Site view: every record kind of one site, with filters and search. */
export default async function SitePage({ params, searchParams }: Props) {
  const { slug } = await params
  const query = await searchParams
  const session = await requireSession(`/sites/${slug}`)
  const sites = await sitesFor(session)
  const site = sites.find((s) => s.slug === slug)
  if (!site) notFound() // not a site this person may see
  const summary = await siteSummary(session, site)

  const tab = (SITE_COLLECTIONS.find((c) => c.slug === query.tab)?.slug ?? 'pages') as string
  const def = TABS[tab]
  const and: Where[] = [{ tenant: { equals: site.id } }]
  for (const f of def.filters) {
    const v = query[f.field]
    if (v && f.options.includes(v)) and.push({ [f.field]: { equals: v === 'true' ? true : v === 'false' ? false : v } })
  }
  const q = query.q?.trim()
  if (q) and.push({ or: def.searchFields.map((field) => ({ [field]: { like: q } })) })
  const page = Math.max(1, Number(query.page) || 1)
  const result = await session.payload.find({
    collection: tab as CollectionSlug, ...as(session), where: { and }, limit: 50, page, depth: 1,
  })

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...query, ...patch })) if (v) next.set(k, v)
    return `/sites/${slug}?${next.toString()}`
  }

  return (
    <Shell session={session} sites={sites} active={`/sites/${slug}`}>
      <header className="cr-head">
        <div>
          <h1>{site.name}</h1>
          <div className="cr-meta">
            <span className={`cr-pill ${summary.status}`}>{summary.status}</span>
            {summary.domain && <span>{summary.domain}</span>}
            <span>
              {summary.lastReceipt
                ? `last sync ${when(summary.lastReceipt.finishedAt)} · rev ${summary.lastReceipt.revision}`
                : 'never synced'}
            </span>
          </div>
        </div>
      </header>

      <nav className="cr-tabs" aria-label="Record kinds">
        {SITE_COLLECTIONS.map((c) => (
          <Link key={c.slug} href={`/sites/${slug}?tab=${c.slug}`} aria-current={c.slug === tab ? 'page' : undefined}>
            {c.label} <b>{summary.counts[c.slug]}</b>
          </Link>
        ))}
      </nav>

      <form className="cr-filters" action={`/sites/${slug}`}>
        <input type="hidden" name="tab" value={tab} />
        <input type="search" name="q" defaultValue={q} placeholder={`Search ${def.searchFields.join(', ')}`} aria-label="Search this tab" />
        {def.filters.map((f) => (
          <select key={f.field} name={f.field} defaultValue={query[f.field] ?? ''} aria-label={f.label}>
            <option value="">{f.label}: any</option>
            {f.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ))}
        <button type="submit">Apply</button>
        {(q || def.filters.some((f) => query[f.field])) && <Link href={`/sites/${slug}?tab=${tab}`}>Clear</Link>}
      </form>

      {result.docs.length === 0 ? (
        <p className="cr-empty">Nothing here{q || def.filters.some((f) => query[f.field]) ? ' matches these filters' : ' yet'}.</p>
      ) : (
        <div className="cr-table-wrap">
          <table className="cr-table">
            <thead>
              <tr>
                {def.columns.map((c, i) => (
                  <th key={i} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.docs.map((doc) => {
                const r = doc as Record<string, any>
                return (
                  <tr key={r.id}>
                    {def.columns.map((c, i) => (
                      <td key={i} className={c.mono ? 'mono' : undefined}>
                        {i === (def.columns[0].label === '' ? 1 : 0) ? <Link href={`/records/${tab}/${r.id}`}>{c.cell(r)}</Link> : c.cell(r)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {result.totalPages > 1 && (
        <nav className="cr-pages" aria-label="Pages">
          {result.hasPrevPage && <Link href={href({ page: String(page - 1) })}>← Previous</Link>}
          <span>
            Page {page} of {result.totalPages} · {result.totalDocs} records
          </span>
          {result.hasNextPage && <Link href={href({ page: String(page + 1) })}>Next →</Link>}
        </nav>
      )}
    </Shell>
  )
}
