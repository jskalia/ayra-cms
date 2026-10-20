import Link from 'next/link'

import { runChecks } from '../../../frontend/checks'
import { sitesFor } from '../../../frontend/data'
import { requireSession } from '../../../frontend/session'
import { Shell } from '../../../frontend/Shell'

export const metadata = { title: 'Checks' }

const ORDER = { bad: 0, warn: 1, info: 2 } as const

/** 9.6 · What needs attention, across the sites this person may see. */
export default async function Checks() {
  const session = await requireSession('/checks')
  const sites = await sitesFor(session)
  const results = await Promise.all(sites.map(async (site) => ({ site, issues: await runChecks(session, site) })))
  const total = results.reduce((n, r) => n + r.issues.filter((i) => i.level !== 'info').length, 0)

  return (
    <Shell session={session} sites={sites} active="/checks">
      <header className="cr-head">
        <h1>Checks</h1>
        <p className="cr-sub">
          {total === 0 ? 'Nothing needs attention.' : `${total} thing${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} attention.`}
        </p>
      </header>
      <div className="cr-checks">
        {results.map(({ site, issues }) => (
          <section className="cr-panel" key={site.slug} aria-labelledby={`chk-${site.slug}`}>
            <h2 id={`chk-${site.slug}`}>
              <Link href={`/sites/${site.slug}`}>{site.name}</Link>
            </h2>
            <ul className="cr-attn">
              {issues.length === 0 ? (
                <li className="calm">All checks pass</li>
              ) : (
                [...issues]
                  .sort((a, b) => ORDER[a.level] - ORDER[b.level])
                  .map((i, n) => (
                    <li key={n} className={i.level === 'info' ? 'calm' : i.level}>
                      {i.href ? <Link href={i.href}>{i.text}</Link> : i.text}
                    </li>
                  ))
              )}
            </ul>
          </section>
        ))}
      </div>
    </Shell>
  )
}
