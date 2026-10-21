import { CircleCheckBig, Info, OctagonAlert, TriangleAlert } from 'lucide-react'
import Link from 'next/link'

import { runChecks, type Issue } from '../../../frontend/checks'
import { sitesWithStatus } from '../../../frontend/data'
import { requireSession } from '../../../frontend/session'
import { Shell } from '../../../frontend/Shell'
import { Badge, Card, CardHeader, cn, PageHeader, Stat } from '../../../frontend/ui'

export const metadata = { title: 'Checks' }

const LEVELS: { level: Issue['level']; title: string; icon: typeof OctagonAlert; tone: string }[] = [
  { level: 'bad', title: 'Problems', icon: OctagonAlert, tone: 'text-bad' },
  { level: 'warn', title: 'Warnings', icon: TriangleAlert, tone: 'text-warn' },
  { level: 'info', title: 'Notes', icon: Info, tone: 'text-info' },
]

/** 9.6 / 10.5 · What needs attention, across the sites this person may see, grouped by how serious it is. */
export default async function Checks() {
  const session = await requireSession('/checks')
  const sites = await sitesWithStatus(session)
  const results = await Promise.all(sites.map(async (site) => ({ site, issues: await runChecks(session, site) })))
  const all = results.flatMap((r) => r.issues)
  const count = (level: Issue['level']) => all.filter((i) => i.level === level).length
  const total = count('bad') + count('warn')

  return (
    <Shell session={session} sites={sites} active="/checks">
      <PageHeader
        title="Checks"
        sub={total === 0 ? 'Nothing needs attention.' : `${total} thing${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} attention.`}
      />
      <Card i={1} className="mb-5 grid grid-cols-3 gap-1 p-2">
        <Stat value={count('bad')} label="problems" tone={count('bad') ? 'bad' : undefined} />
        <Stat value={count('warn')} label="warnings" tone={count('warn') ? 'warn' : undefined} />
        <Stat value={count('info')} label="notes" />
      </Card>
      <p className="cr-rise mb-5 text-[13px] text-muted">
        These catch what the write-time rules cannot: something changing after a page was approved (a cited claim made internal, a product unreleased), review dates passing, records left behind in a site, and failed syncs.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {results.map(({ site, issues }, n) => (
          <Card key={site.slug} i={2 + n} aria-labelledby={`chk-${site.slug}`}>
            <CardHeader
              plain
              id={`chk-${site.slug}`}
              title={<Link href={`/sites/${site.slug}`} className="hover:text-accent">{site.name}</Link>}
              action={issues.some((i) => i.level !== 'info') ? <Badge tone={issues.some((i) => i.level === 'bad') ? 'bad' : 'warn'}>{issues.filter((i) => i.level !== 'info').length} open</Badge> : <Badge tone="ok">clear</Badge>}
            />
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 px-4 pb-4 text-[13.5px] text-muted">
                <CircleCheckBig className="size-4 text-ok" aria-hidden /> All checks pass
              </p>
            ) : (
              <div className="flex flex-col gap-3 px-2 pb-3">
                {LEVELS.map(({ level, title, icon: Icon, tone }) => {
                  const list = issues.filter((i) => i.level === level)
                  if (!list.length) return null
                  return (
                    <div key={level}>
                      <h3 className="px-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                        {title} · {list.length}
                      </h3>
                      <ul>
                        {list.map((i, k) => {
                          const body = (
                            <>
                              <Icon className={cn('mt-0.5 size-4 shrink-0', tone)} aria-hidden />
                              <span className="text-[13.5px]">{i.text}</span>
                            </>
                          )
                          return (
                            <li key={k}>
                              {i.href ? (
                                <Link href={i.href} className="flex items-start gap-2.5 rounded-[10px] px-2 py-2 hover:bg-surface-2">
                                  {body}
                                </Link>
                              ) : (
                                <span className="flex items-start gap-2.5 px-2 py-2">{body}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        ))}
      </div>
    </Shell>
  )
}
