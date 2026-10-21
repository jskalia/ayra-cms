import { AlertTriangle, FileStack, ListChecks, Play } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CollectionSlug } from 'payload'

import { sitesWithStatus, when } from '../../../../frontend/data'
import { as, requireSession } from '../../../../frontend/session'
import { Shell } from '../../../../frontend/Shell'
import { Badge, Card, CardHeader, DetailList, EmptyState, Mono, PageHeader, Stat, Table, Td, Th, Tr } from '../../../../frontend/ui'

export const metadata = { title: 'Receipt' }

type Doc = Record<string, any>
type Item = { collection: string; recordId: string; sourcePath: string; sha256: string; action: string }

const ACTION_TONE: Record<string, 'ok' | 'info' | 'warn'> = { create: 'ok', update: 'info', supersede: 'warn' }

/** 9.5 / 10.5 · One sync run in full. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession(`/receipts/${id}`)
  let r: Doc
  try {
    r = (await session.payload.findByID({ collection: 'sync-receipts', id, ...as(session), depth: 0 })) as Doc
  } catch {
    notFound()
  }
  const sites = await sitesWithStatus(session)
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
  const orphans: Doc[] = r.orphans ?? []

  return (
    <Shell session={session} sites={sites} active="/receipts">
      <PageHeader
        crumbs={[{ href: '/receipts', label: 'Sync receipts' }, { href: `/receipts?site=${site.slug}`, label: site.name }]}
        title={
          <>
            {site.name} · <span className="font-mono">rev {r.revision}</span>
          </>
        }
        meta={
          <>
            <Badge tone={r.status === 'ok' ? 'ok' : 'bad'}>{r.status}</Badge>
            <Mono className="text-muted">{r.receiptId}</Mono>
          </>
        }
      />

      {r.error && (
        <div role="alert" className="cr-rise mb-4 flex items-start gap-3 rounded-[12px] border border-bad/30 bg-bad-soft px-4 py-3 text-[13.5px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
          <span>
            <b className="text-bad">The run stopped.</b> {r.error}
          </span>
        </div>
      )}

      <Card i={1} className="mb-4 grid grid-cols-2 gap-1 p-2 sm:grid-cols-5">
        <Stat value={r.counts?.create ?? 0} label="created" tone={r.counts?.create ? 'ok' : undefined} />
        <Stat value={r.counts?.update ?? 0} label="updated" />
        {r.counts?.supersede ? <Stat value={r.counts.supersede} label="superseded" tone="warn" /> : null}
        <Stat value={r.counts?.unchanged ?? 0} label="unchanged" />
        <Stat value={orphans.length} label="not in _ops" tone={orphans.length ? 'warn' : undefined} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card i={2} className="min-w-0" aria-labelledby="h-changes">
          <CardHeader id="h-changes" title="What changed" icon={<ListChecks />} count={changed.length} />
          {changed.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Action</Th>
                  <Th>Kind</Th>
                  <Th>Record</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {changed.map((i) => {
                  const href = links.get(`${i.collection}|${i.recordId}`)
                  return (
                    <Tr key={`${i.collection}|${i.recordId}`}>
                      <Td>
                        <Badge tone={ACTION_TONE[i.action] ?? 'neutral'}>{i.action}</Badge>
                      </Td>
                      <Td className="text-muted">{i.collection}</Td>
                      <Td mono>
                        {href ? (
                          <Link href={href} className="hover:text-accent">
                            {i.recordId}
                          </Link>
                        ) : (
                          i.recordId
                        )}
                      </Td>
                      <Td mono className="text-[11.5px] text-muted">
                        {i.sourcePath}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="Nothing changed">The site already matched _ops.</EmptyState>
          )}
        </Card>

        <aside className="flex flex-col gap-4" aria-label="About this run">
          <Card i={3} aria-labelledby="h-run">
            <CardHeader id="h-run" title="Run" icon={<Play />} />
            <DetailList
              items={[
                ['By', r.actor],
                ['Started', <Mono key="s">{String(r.startedAt).replace('T', ' ').slice(0, 16)}</Mono>],
                ['Finished', when(r.finishedAt)],
                ['_ops commit', <Mono key="c">{r.opsCommit ? String(r.opsCommit).slice(0, 12) : '—'}</Mono>],
                ['Source', <Mono key="p" className="break-all text-muted">{r.sourceRoot ?? '—'}</Mono>],
              ]}
            />
          </Card>
          <Card i={4} aria-labelledby="h-orphans">
            <CardHeader id="h-orphans" title="No longer in _ops" icon={<FileStack />} count={orphans.length} />
            {orphans.length ? (
              <div className="px-4 pb-4">
                <p className="mb-2 text-[12.5px] text-muted">These stay in the site (the sync never deletes). Retire them in _ops if they should go.</p>
                <ul className="flex flex-col gap-1">
                  {orphans.map((o) => (
                    <li key={`${o.collection}|${o.recordId}`} className="flex items-center gap-2">
                      <Mono className="min-w-0 flex-1 truncate">{o.recordId}</Mono>
                      <span className="text-[11.5px] text-faint">{o.collection}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="px-4 pb-4 text-[13px] text-muted">None.</p>
            )}
          </Card>
        </aside>
      </div>
    </Shell>
  )
}
