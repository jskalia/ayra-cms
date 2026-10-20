import Link from 'next/link'
import type { ReactNode } from 'react'

import type { Session } from './session'

type Site = { slug: string; name: string; status?: string }

/** The control room's frame: the black bookend with sites and tools, and the page body. */
export function Shell({
  session,
  sites,
  active,
  children,
}: {
  session: Session
  sites: Site[]
  active: string
  children: ReactNode
}) {
  const link = (href: string, label: string, extra?: ReactNode) => (
    <Link key={href} className="cr-link" href={href} aria-current={active === href ? 'page' : undefined}>
      {extra}
      {label}
    </Link>
  )
  return (
    <div className="cr">
      <nav className="cr-side" aria-label="Control room">
        <Link className="cr-brand" href="/">
          Ayra CMS <span>control room</span>
        </Link>
        <div className="cr-group">
          {link('/', 'Overview')}
        </div>
        <div className="cr-group">
          <h2>Sites</h2>
          {sites.map((s) =>
            link(`/sites/${s.slug}`, s.name, <i className={`cr-dot ${s.status === 'live' || s.status === 'preview' ? s.status : ''}`} aria-hidden />),
          )}
          {sites.length === 0 && <p className="cr-who">No sites assigned to you yet.</p>}
        </div>
        <div className="cr-group">
          <h2>Tools</h2>
          {link('/receipts', 'Sync receipts')}
          {link('/checks', 'Checks')}
          {link('/search', 'Search')}
          {session.isAdmin && (
            <a className="cr-link" href="/admin">
              Accounts and keys
            </a>
          )}
        </div>
        <p className="cr-who">
          <strong>{session.user.name ?? session.user.email}</strong>
          {session.isAdmin ? 'Admin' : 'Viewer'} · read-only for content
          <br />
          <a href="/admin/logout">Sign out</a>
        </p>
      </nav>
      <main className="cr-main">{children}</main>
    </div>
  )
}
