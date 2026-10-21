import Link from 'next/link'
import type { ReactNode } from 'react'

import type { Session } from './session'
import { Logo } from './shell/Logo'
import type { NavSection, ShellSite } from './shell/nav'
import { NavList } from './shell/NavList'
import { PhoneDock, SiteSwitcher, TopBar } from './shell/TopBar'

/**
 * The control room's frame (Phase 10, the AyraAgent look): a sidebar with the logo, a site
 * switcher and grouped links; a top bar with ⌘K search, Ask Ayra, theme and account; on a phone,
 * a slide-in menu and a bottom dock. `active` is the href of the current page.
 */
export function Shell({ session, sites, active, children }: { session: Session; sites: ShellSite[]; active: string; children: ReactNode }) {
  const sections: NavSection[] = [
    {
      title: 'Workspace',
      items: [
        { href: '/', label: 'Overview', icon: 'home' },
        { href: '/search', label: 'Search', icon: 'search' },
      ],
    },
    {
      title: 'Sites',
      items: sites.map((s) => ({ href: `/sites/${s.slug}`, label: s.name, icon: 'site', dot: s.status ?? 'none' })),
    },
    {
      title: 'Operations',
      items: [
        { href: '/receipts', label: 'Sync receipts', icon: 'receipts' },
        { href: '/checks', label: 'Checks', icon: 'checks' },
      ],
    },
    ...(session.isAdmin ? [{ title: 'Admin', items: [{ href: '/admin', label: 'Accounts and keys', icon: 'admin' as const, external: true }] }] : []),
  ]
  const currentSite = active.startsWith('/sites/') ? active.slice('/sites/'.length) : undefined
  const user = {
    name: String(session.user.name ?? ''),
    email: String(session.user.email ?? ''),
    role: session.isAdmin ? ('Admin' as const) : ('Viewer' as const),
    isAdmin: session.isAdmin,
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_1fr]">
      <aside className="cr-scroll sticky top-0 hidden h-dvh flex-col gap-5 overflow-y-auto border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <Link href="/" className="px-1.5 pt-0.5" aria-label="Ayra CMS overview">
          <Logo />
        </Link>
        <SiteSwitcher sites={sites} current={currentSite} />
        <NavList sections={sections} active={active} />
        <div className="mt-auto rounded-[12px] border border-border bg-surface px-3 py-2.5 text-[12px] text-muted">
          <p className="font-semibold text-text">Ayra CMS</p>
          <p>Content comes in only through the sync; this view is read-only.</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <TopBar sections={sections} active={active} user={user} sites={sites} currentSite={currentSite} />
        <main id="main" className="mx-auto w-full max-w-[1320px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>
      <PhoneDock active={active} />
      <form id="cr-sign-out" action="/sign-out" method="post" hidden />
    </div>
  )
}
