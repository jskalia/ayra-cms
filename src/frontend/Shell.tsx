import Link from 'next/link'
import type { ReactNode } from 'react'

import { pendingBlogs } from './blogs'
import type { Session } from './session'
import { Logo } from './shell/Logo'
import type { NavSection, ShellSite } from './shell/nav'
import { NavList } from './shell/NavList'
import { PhoneDock, SiteSwitcher, TopBar } from './shell/TopBar'

/**
 * The control room's frame (Phase 10, the AyraAgent look): a sidebar with the logo, a site
 * switcher and grouped links; a top bar with ⌘K search, theme and account; on a phone,
 * a slide-in menu and a bottom dock. `active` is the href of the current page.
 */
export async function Shell({ session, sites, active, children }: { session: Session; sites: ShellSite[]; active: string; children: ReactNode }) {
  const pending = await pendingBlogs(session)
  const sections: NavSection[] = [
    {
      items: [{ href: '/', label: 'Blogs', icon: 'blogs', badge: pending }],
    },
    {
      title: 'Sites',
      items: sites.map((s) => ({ href: `/sites/${s.slug}`, label: s.name, icon: 'site', dot: s.status ?? 'none' })),
    },
    {
      title: 'More',
      items: [
        { href: '/overview', label: 'Overview', icon: 'home' },
        { href: '/search', label: 'Search', icon: 'search' },
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
    <div className="min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[252px_1fr] lg:overflow-hidden">
      <aside className="cr-scroll hidden h-dvh flex-col gap-5 overflow-y-auto border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <Link href="/" className="px-1.5 pt-0.5" aria-label="Ayra CMS, blogs">
          <Logo />
        </Link>
        <SiteSwitcher sites={sites} current={currentSite} />
        <NavList sections={sections} active={active} />
      </aside>
      {/* On a desktop the frame (sidebar and top bar) fills the screen and never moves; only this area
          scrolls, and its scrollbar space is reserved so pages do not shift sideways. */}
      <div className="flex min-w-0 flex-col lg:h-dvh lg:min-h-0">
        <TopBar sections={sections} active={active} user={user} sites={sites} currentSite={currentSite} />
        <div id="cr-scroll" className="cr-scroll flex flex-1 flex-col lg:min-h-0 lg:overflow-y-auto lg:[scrollbar-gutter:stable]">
          <main id="main" className="mx-auto w-full max-w-[1320px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
            {children}
          </main>
        </div>
      </div>
      <PhoneDock active={active} />
      <form id="cr-sign-out" action="/sign-out" method="post" hidden />
    </div>
  )
}
