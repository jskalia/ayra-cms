import Link from 'next/link'

import { SITE_COLLECTIONS, siteSummary, sitesFor, when } from '../../frontend/data'
import { requireSession } from '../../frontend/session'
import { Shell } from '../../frontend/Shell'

export const metadata = { title: 'Overview' }

/** 9.2 · Overview: one card per site the signed-in person may see. */
export default async function Overview() {
  const session = await requireSession('/')
  const sites = await sitesFor(session)
  const summaries = await Promise.all(sites.map((s) => siteSummary(session, s)))

  return (
    <Shell session={session} sites={summaries} active="/">
      <header className="cr-head">
        <h1>Overview</h1>
        <p className="cr-sub">What each site holds, where it came from, and what needs attention.</p>
      </header>
      {summaries.length === 0 ? (
        <p className="cr-empty">No sites are assigned to your account yet. An admin can add them.</p>
      ) : (
        <div className="cr-grid">
          {summaries.map((s) => (
            <article className="cr-card" key={s.slug} aria-labelledby={`site-${s.slug}`}>
              <div>
                <h2 id={`site-${s.slug}`}>
                  <Link href={`/sites/${s.slug}`}>{s.name}</Link>
                </h2>
                <div className="cr-meta">
                  <span className={`cr-pill ${s.status}`}>{s.status}</span>
                  {s.domain && <span>{s.domain}</span>}
                  <span>
                    {s.lastReceipt ? (
                      <>
                        last sync {when(s.lastReceipt.finishedAt)} · rev {s.lastReceipt.revision}{' '}
                        <span className={`cr-pill ${s.lastReceipt.status}`}>{s.lastReceipt.status}</span>
                      </>
                    ) : (
                      'never synced'
                    )}
                  </span>
                </div>
              </div>
              <div className="cr-stats">
                {SITE_COLLECTIONS.map((c) => (
                  <Link className="cr-stat" key={c.slug} href={`/sites/${s.slug}?tab=${c.slug}`}>
                    <b>{s.counts[c.slug]}</b>
                    <span>{c.label}</span>
                  </Link>
                ))}
              </div>
              <ul className="cr-attn" aria-label="Needs attention">
                {s.attention.length === 0 ? (
                  <li className="calm">Nothing needs attention</li>
                ) : (
                  s.attention.map((a) => (
                    <li className={a.level} key={a.text}>
                      {a.href ? <Link href={a.href}>{a.text}</Link> : a.text}
                    </li>
                  ))
                )}
              </ul>
            </article>
          ))}
        </div>
      )}
    </Shell>
  )
}
