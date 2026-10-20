import Link from 'next/link'
import type { Where } from 'payload'

import { sitesFor, when } from '../../../frontend/data'
import { as, requireSession } from '../../../frontend/session'
import { Shell } from '../../../frontend/Shell'

export const metadata = { title: 'Sync receipts' }

type Doc = Record<string, any>

/** 9.5 · Every sync run on the sites this person may see, newest first. */
export default async function Receipts({ searchParams }: { searchParams: Promise<{ site?: string; status?: string }> }) {
  const query = await searchParams
  const session = await requireSession('/receipts')
  const sites = await sitesFor(session)
  const bySite = new Map(sites.map((s) => [String(s.id), s]))
  const and: Where[] = []
  const site = sites.find((s) => s.slug === query.site)
  if (site) and.push({ tenant: { equals: site.id } })
  if (query.status === 'ok' || query.status === 'failed') and.push({ status: { equals: query.status } })
  const { docs } = await session.payload.find({
    collection: 'sync-receipts', ...as(session), depth: 0, limit: 100, sort: '-finishedAt', where: and.length ? { and } : undefined,
  })

  return (
    <Shell session={session} sites={sites} active="/receipts">
      <header className="cr-head">
        <h1>Sync receipts</h1>
        <p className="cr-sub">One per sync run: who ran it, what changed, what is no longer in _ops.</p>
      </header>
      <form className="cr-filters" action="/receipts">
        <select name="site" defaultValue={query.site ?? ''} aria-label="Site">
          <option value="">Site: any</option>
          {sites.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={query.status ?? ''} aria-label="Status">
          <option value="">Status: any</option>
          <option value="ok">ok</option>
          <option value="failed">failed</option>
        </select>
        <button type="submit">Apply</button>
      </form>
      {docs.length === 0 ? (
        <p className="cr-empty">No sync has run yet{site ? ` for ${site.name}` : ''}.</p>
      ) : (
        <div className="cr-table-wrap">
          <table className="cr-table">
            <thead>
              <tr>
                {['Receipt', 'Site', 'Status', 'Created', 'Updated', 'Unchanged', 'Not in _ops', 'By', 'When'].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(docs as Doc[]).map((r) => (
                <tr key={r.id}>
                  <td className="mono">
                    <Link href={`/receipts/${r.id}`}>rev {r.revision}</Link>
                  </td>
                  <td>{bySite.get(String(typeof r.tenant === 'object' ? r.tenant?.id : r.tenant))?.name ?? '—'}</td>
                  <td>
                    <span className={`cr-pill ${r.status}`}>{r.status}</span>
                  </td>
                  <td className="mono">{r.counts?.create ?? 0}</td>
                  <td className="mono">{r.counts?.update ?? 0}</td>
                  <td className="mono">{r.counts?.unchanged ?? 0}</td>
                  <td className="mono">{r.orphans?.length ?? 0}</td>
                  <td>{r.actor}</td>
                  <td className="mono">{when(r.finishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  )
}
