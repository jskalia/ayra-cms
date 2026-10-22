import { AlertTriangle, ArrowRight, CircleCheckBig, Globe, OctagonAlert, ReceiptText, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { runChecks } from '../../../frontend/checks'
import { SITE_COLLECTIONS, siteSummary, sitesFor, when, type Receipt } from '../../../frontend/data'
import { as, requireSession } from '../../../frontend/session'
import { Shell } from '../../../frontend/Shell'
import { Greeting } from '../../../frontend/shell/Greeting'
import { Badge, ButtonLink, Card, CardHeader, Dot, EmptyState, Mono, StatusBadge, toneOf } from '../../../frontend/ui'

export const metadata = { title: 'Overview' }

/** 9.2 / 10.3 · Home: the greeting band and its numbers, then what needs attention, the latest syncs and every site. */
export default async function Overview() {
  const session = await requireSession('/overview')
  const sites = await sitesFor(session)
  const [summaries, checks, receipts] = await Promise.all([
    Promise.all(sites.map((s) => siteSummary(session, s))),
    Promise.all(sites.map(async (site) => ({ site, issues: await runChecks(session, site) }))),
    session.payload.find({ collection: 'sync-receipts', ...as(session), depth: 0, limit: 6, sort: '-finishedAt' }),
  ])
  const issues = checks.flatMap(({ site, issues }) => issues.filter((i) => i.level !== 'info').map((i) => ({ ...i, site })))
  const problems = issues.filter((i) => i.level === 'bad').length
  const records = summaries.reduce((n, s) => n + Object.values(s.counts).reduce((a, b) => a + b, 0), 0)
  const latest = receipts.docs[0] as unknown as Receipt | undefined
  const siteName = new Map(sites.map((s) => [String(s.id), s]))

  const strip = [
    { label: 'Need you', value: issues.length, hint: problems ? `${problems} problem${problems === 1 ? '' : 's'}` : issues.length ? 'warnings only' : 'all clear', href: '/checks', icon: OctagonAlert },
    { label: 'Sites', value: sites.length, hint: `${summaries.filter((s) => s.status === 'live').length} live`, href: undefined, icon: Globe },
    { label: 'Records', value: records, hint: 'across your sites', href: undefined, icon: CircleCheckBig },
    { label: 'Last sync', value: latest ? when(latest.finishedAt) : 'never', hint: latest ? `rev ${latest.revision} · ${latest.status}` : 'no sync has run', href: latest ? `/receipts/${latest.id}` : '/receipts', icon: ReceiptText },
  ]

  return (
    <Shell session={session} sites={summaries} active="/overview">
      <h1 className="sr-only">Overview</h1>
      <section
        className="cr-rise relative overflow-hidden rounded-[18px] px-5 py-5 text-white sm:px-6"
        style={{ background: 'linear-gradient(120deg, var(--band-from), var(--band-to))' }}
        aria-label="Summary"
      >
        <Greeting name={String(session.user.name ?? '')} />
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {strip.map(({ label, value, hint, href, icon: Icon }) => {
            const body = (
              <>
                <dt className="flex items-center gap-1.5 text-[12px] font-medium text-white">
                  <Icon className="size-3.5" aria-hidden /> {label}
                </dt>
                <dd className="mt-1 font-mono text-[22px] leading-none font-semibold tracking-[-0.03em]">{value}</dd>
                <dd className="mt-1 text-[11.5px] text-white/90">{hint}</dd>
              </>
            )
            return href ? (
              <Link key={label} href={href} className="rounded-[12px] bg-white/10 px-3 py-2.5 transition-colors hover:bg-white/[0.16]">
                {body}
              </Link>
            ) : (
              <div key={label} className="rounded-[12px] bg-white/10 px-3 py-2.5">
                {body}
              </div>
            )
          })}
        </dl>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card i={1} className="xl:col-span-2" aria-labelledby="h-attention">
          <CardHeader
            id="h-attention"
            title="Needs attention"
            icon={<AlertTriangle />}
            count={issues.length}
            action={issues.length > 0 && <ButtonLink href="/checks" variant="ghost" size="sm">All checks <ArrowRight className="size-3.5" aria-hidden /></ButtonLink>}
          />
          {issues.length === 0 ? (
            <EmptyState title="Nothing needs attention" icon={<CircleCheckBig />}>
              Every public page cites public records, reviews are up to date, and the last syncs passed.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border px-2 pb-2">
              {issues.slice(0, 8).map((i, n) => (
                <li key={n}>
                  <Link href={i.href ?? `/sites/${i.site.slug}`} className="flex items-start gap-3 rounded-[10px] px-2 py-2.5 hover:bg-surface-2">
                    <Dot tone={i.level} className="mt-1.5" />
                    <span className="min-w-0 flex-1 text-[13.5px]">{i.text}</span>
                    <span className="shrink-0 text-[12px] text-faint">{i.site.name}</span>
                  </Link>
                </li>
              ))}
              {issues.length > 8 && (
                <li className="px-2 py-2.5 text-[12.5px] text-muted">
                  …and {issues.length - 8} more on the <Link href="/checks" className="text-accent hover:underline">checks page</Link>.
                </li>
              )}
            </ul>
          )}
        </Card>

        <Card i={2} aria-labelledby="h-syncs">
          <CardHeader id="h-syncs" title="Latest syncs" icon={<ReceiptText />} action={<ButtonLink href="/receipts" variant="ghost" size="sm">All <ArrowRight className="size-3.5" aria-hidden /></ButtonLink>} />
          {receipts.docs.length === 0 ? (
            <EmptyState title="No sync has run yet" icon={<ReceiptText />}>
              Each sync from _ops files a receipt here: who ran it and what changed.
            </EmptyState>
          ) : (
            <ul className="px-2 pb-2">
              {(receipts.docs as unknown as Receipt[]).map((r) => (
                <li key={r.id}>
                  <Link href={`/receipts/${r.id}`} className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 hover:bg-surface-2">
                    <Dot tone={r.status === 'ok' ? 'ok' : 'bad'} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{siteName.get(String((r as unknown as { tenant: unknown }).tenant))?.name ?? 'Site'}</span>
                      <span className="block text-[12px] text-muted">
                        <Mono>rev {r.revision}</Mono> · {r.counts?.create ?? 0} new · {r.counts?.update ?? 0} updated
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11.5px] text-faint">{when(r.finishedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section aria-labelledby="h-sites" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="h-sites" className="text-[15px] font-bold">Sites</h2>
          <span className="text-[12.5px] text-muted">{sites.length} you can see</span>
        </div>
        {summaries.length === 0 ? (
          <Card>
            <EmptyState title="No sites yet" icon={<Globe />}>
              No sites are assigned to your account yet. An admin can add them.
            </EmptyState>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summaries.map((s, n) => {
              const shown = SITE_COLLECTIONS.filter((c) => c.always || s.counts[c.slug] > 0)
              const siteIssues = issues.filter((i) => i.site.slug === s.slug)
              return (
                <Card as="article" key={s.slug} i={3 + n} className="flex flex-col" aria-labelledby={`site-${s.slug}`}>
                  <div className="flex items-start justify-between gap-3 px-4 pt-4">
                    <div className="min-w-0">
                      <h3 id={`site-${s.slug}`} className="truncate text-[15px] font-bold">
                        <Link href={`/sites/${s.slug}`} className="hover:text-accent">
                          {s.name}
                        </Link>
                      </h3>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted">{s.domain ?? 'no domain yet'}</p>
                    </div>
                    <StatusBadge value={s.status} tone={toneOf(s.status)} />
                  </div>
                  <div className="grid grid-cols-4 gap-1 px-2 pt-3">
                    {shown.slice(0, 8).map((c) => (
                      <Link key={c.slug} href={`/sites/${s.slug}?tab=${c.slug}`} className="flex flex-col rounded-[8px] px-2 py-1.5 hover:bg-surface-2">
                        <span className="font-mono text-[16px] font-semibold">{s.counts[c.slug]}</span>
                        <span className="truncate text-[11px] text-muted">{c.label}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-[12px] text-muted">
                    <span>{s.lastReceipt ? <>synced {when(s.lastReceipt.finishedAt)} · <Mono>rev {s.lastReceipt.revision}</Mono></> : 'never synced'}</span>
                    {siteIssues.length > 0 ? (
                      <Badge tone={siteIssues.some((i) => i.level === 'bad') ? 'bad' : 'warn'}>{siteIssues.length} to check</Badge>
                    ) : s.lastReceipt ? (
                      <Badge tone="ok">clear</Badge>
                    ) : (
                      <Badge>not synced yet</Badge>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <Card i={4 + summaries.length} className="mt-8 overflow-hidden" aria-labelledby="h-ask">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="h-ask" className="text-[15px] font-bold">
              Ask Ayra <Badge tone="accent" className="ml-1 align-middle">coming soon</Badge>
            </h2>
            <p className="mt-1 text-[13.5px] text-muted">
              Ask what is live, what is out of date, or which pages cite a claim. Ayra will read and suggest only: it never approves, publishes or syncs.
            </p>
          </div>
          <div aria-hidden className="flex h-10 w-full items-center rounded-[10px] border border-dashed border-border-strong px-3 text-[13px] text-faint sm:w-[320px]">
            What changed on junaidkalia this week?
          </div>
        </div>
      </Card>
    </Shell>
  )
}
