import { ReceiptText, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import type { Where } from 'payload'
import type { CSSProperties } from 'react'

import { sitesWithStatus, when } from '../../../frontend/data'
import { as, requireSession } from '../../../frontend/session'
import { Shell } from '../../../frontend/Shell'
import { Badge, Button, ButtonLink, Card, cn, EmptyState, fieldClass, Mono, PageHeader } from '../../../frontend/ui'

export const metadata = { title: 'Sync receipts' }

type Doc = Record<string, any>

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** 9.5 / 10.5 · Every sync run on the sites this person may see, newest first, as a timeline by day. */
export default async function Receipts({ searchParams }: { searchParams: Promise<{ site?: string; status?: string }> }) {
  const query = await searchParams
  const session = await requireSession('/receipts')
  const sites = await sitesWithStatus(session)
  const bySite = new Map(sites.map((s) => [String(s.id), s]))
  const and: Where[] = []
  const site = sites.find((s) => s.slug === query.site)
  if (site) and.push({ tenant: { equals: site.id } })
  if (query.status === 'ok' || query.status === 'failed') and.push({ status: { equals: query.status } })
  const { docs } = await session.payload.find({
    collection: 'sync-receipts', ...as(session), depth: 0, limit: 100, sort: '-finishedAt', where: and.length ? { and } : undefined,
  })
  const days = new Map<string, Doc[]>()
  for (const r of docs as Doc[]) {
    const key = String(r.finishedAt ?? '').slice(0, 10)
    days.set(key, [...(days.get(key) ?? []), r])
  }
  const filtered = Boolean(site || query.status)

  return (
    <Shell session={session} sites={sites} active="/receipts">
      <PageHeader title="Sync receipts" sub="One per sync run: who ran it, what changed, and what is no longer in _ops." />

      <form action="/receipts" className="cr-rise mb-5 flex flex-wrap items-center gap-2">
        <select name="site" defaultValue={query.site ?? ''} aria-label="Site" className={fieldClass}>
          <option value="">Site: any</option>
          {sites.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={query.status ?? ''} aria-label="Status" className={fieldClass}>
          <option value="">Status: any</option>
          <option value="ok">ok</option>
          <option value="failed">failed</option>
        </select>
        <Button type="submit" variant="primary">
          <SlidersHorizontal className="size-3.5" aria-hidden /> Apply
        </Button>
        {filtered && (
          <ButtonLink href="/receipts" variant="ghost">
            Clear
          </ButtonLink>
        )}
      </form>

      {docs.length === 0 ? (
        <Card i={1}>
          <EmptyState title={`No sync has run yet${site ? ` for ${site.name}` : ''}`} icon={<ReceiptText />}>
            Each run of the sync from _ops files a receipt here, in the CMS and back in _ops.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {[...days].map(([key, rows], n) => (
            <section key={key} aria-label={key ? day(key) : 'Undated'} className="cr-rise" style={{ '--i': n + 1 } as CSSProperties}>
              <h2 className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">{key ? `${day(key)} · UTC` : 'Undated'}</h2>
              <ol className="relative ml-2 border-l border-border">
                {rows.map((r) => {
                  const ok = r.status === 'ok'
                  const siteName = bySite.get(String(typeof r.tenant === 'object' ? r.tenant?.id : r.tenant))?.name ?? '—'
                  const orphans = r.orphans?.length ?? 0
                  return (
                    <li key={r.id} className="relative pb-3 pl-5 last:pb-0">
                      <span aria-hidden className={cn('absolute top-4 -left-[5px] size-[9px] rounded-full ring-4 ring-bg', ok ? 'bg-ok' : 'bg-bad')} />
                      <Link href={`/receipts/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[12px] border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:border-border-strong">
                        <span className="flex min-w-[180px] flex-1 items-center gap-2">
                          <span className="text-[14px] font-semibold">{siteName}</span>
                          <Mono className="text-muted">rev {r.revision}</Mono>
                          <Badge tone={ok ? 'ok' : 'bad'}>{r.status}</Badge>
                        </span>
                        <span className="flex flex-wrap gap-1.5 text-[12px]">
                          <Badge tone="ok">{r.counts?.create ?? 0} new</Badge>
                          <Badge tone="info">{r.counts?.update ?? 0} updated</Badge>
                          <Badge>{r.counts?.unchanged ?? 0} unchanged</Badge>
                          {orphans > 0 && <Badge tone="warn">{orphans} not in _ops</Badge>}
                        </span>
                        <span className="text-[12px] text-muted">
                          {r.actor} · <Mono>{when(r.finishedAt)}</Mono>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </Shell>
  )
}
