import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CollectionSlug } from 'payload'

import { sitesFor, when } from '../../../../frontend/data'
import { as, requireSession } from '../../../../frontend/session'
import { Shell } from '../../../../frontend/Shell'

export const metadata = { title: 'Receipt' }

type Doc = Record<string, any>
type Item = { collection: string; recordId: string; sourcePath: string; sha256: string; action: string }

/** 9.5 · One sync run in full. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession(`/receipts/${id}`)
  let r: Doc
  try {
    r = (await session.payload.findByID({ collection: 'sync-receipts', id, ...as(session), depth: 0 })) as Doc
  } catch {
    notFound()
  }
  const sites = await sitesFor(session)
  const tenant = typeof r.tenant === 'object' ? r.tenant?.id : r.tenant
  const site = sites.find((s) => String(s.id) === String(tenant))
  if (!site) notFound()

  const items: Item[] = r.items ?? []
  const changed = items.filter((i) => i.action !== 'unchanged')
  // Resolve record ids to CMS documents, so each changed item links to its record view.
  const links = new Map<string, string>()
  for (const collection of [...new Set(changed.map((i) => i.collection))]) {
    const ids = changed.filter((i) => i.collection === collection).map((i) => i.recordId)
    const { docs } = await session.payload.find({
      collection: collection as CollectionSlug, ...as(session), depth: 0, limit: ids.length, pagination: false,
      where: { and: [{ tenant: { equals: tenant } }, { recordId: { in: ids } }] },
    })
    for (const d of docs as Doc[]) links.set(`${collection}|${d.recordId}`, `/records/${collection}/${d.id}`)
  }

  return (
    <Shell session={session} sites={sites} active="/receipts">
      <p className="cr-crumbs">
        <Link href="/receipts">Sync receipts</Link> / <Link href={`/receipts?site=${site.slug}`}>{site.name}</Link>
      </p>
      <header className="cr-head">
        <div>
          <h1>
            {site.name} · rev {r.revision}
          </h1>
          <div className="cr-meta">
            <span className={`cr-pill ${r.status}`}>{r.status}</span>
            <span className="mono">{r.receiptId}</span>
          </div>
        </div>
      </header>

      <div className="cr-record">
        <section className="cr-panel" aria-labelledby="h-changes">
          <h2 id="h-changes">What changed</h2>
          {r.error && <p className="cr-error">Stopped at: {r.error}</p>}
          <div className="cr-stats">
            {(['create', 'update', 'unchanged'] as const).map((k) => (
              <div className="cr-stat" key={k}>
                <b>{r.counts?.[k] ?? 0}</b>
                <span>{k === 'create' ? 'created' : k === 'update' ? 'updated' : 'unchanged'}</span>
              </div>
            ))}
            <div className="cr-stat">
              <b>{r.orphans?.length ?? 0}</b>
              <span>not in _ops</span>
            </div>
          </div>
          {changed.length > 0 ? (
            <div className="cr-table-wrap">
              <table className="cr-table">
                <thead>
                  <tr>
                    <th scope="col">Action</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Record</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {changed.map((i) => {
                    const href = links.get(`${i.collection}|${i.recordId}`)
                    return (
                      <tr key={`${i.collection}|${i.recordId}`}>
                        <td>
                          <span className={`cr-pill ${i.action === 'create' ? 'ok' : 'warn'}`}>{i.action}</span>
                        </td>
                        <td>{i.collection}</td>
                        <td className="mono">{href ? <Link href={href}>{i.recordId}</Link> : i.recordId}</td>
                        <td className="mono cr-small">{i.sourcePath}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="cr-small">Nothing changed: the site already matched _ops.</p>
          )}
        </section>

        <aside className="cr-side-panels">
          <section className="cr-panel" aria-labelledby="h-run">
            <h2 id="h-run">Run</h2>
            <dl className="cr-dl">
              <div><dt>By</dt><dd>{r.actor}</dd></div>
              <div><dt>Started</dt><dd>{String(r.startedAt).replace('T', ' ').slice(0, 16)}</dd></div>
              <div><dt>Finished</dt><dd>{when(r.finishedAt)}</dd></div>
              <div><dt>_ops commit</dt><dd className="mono">{r.opsCommit ? String(r.opsCommit).slice(0, 12) : '—'}</dd></div>
              <div><dt>Source</dt><dd className="mono cr-small">{r.sourceRoot ?? '—'}</dd></div>
            </dl>
          </section>
          <section className="cr-panel" aria-labelledby="h-orphans">
            <h2 id="h-orphans">No longer in _ops</h2>
            {r.orphans?.length ? (
              <>
                <p className="cr-small">These stay in the site (the sync never deletes). Retire them in _ops if they should go.</p>
                <ul className="cr-list">
                  {r.orphans.map((o: Doc) => (
                    <li key={`${o.collection}|${o.recordId}`} className="mono">
                      {o.recordId} <span className="cr-small">{o.collection}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="cr-small">None.</p>
            )}
          </section>
        </aside>
      </div>
    </Shell>
  )
}
