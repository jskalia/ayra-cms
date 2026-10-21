'use client'

import { Command } from 'cmdk'
import * as Dialog from '@radix-ui/react-dialog'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { ChevronsUpDown, CornerDownLeft, KeyRound, LogOut, Menu as MenuIcon, Moon, Search, Sparkles, Sun, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { cn, Dot, toneOf } from '../ui'
import { ICONS } from './icons'
import { Logo } from './Logo'
import { NavList } from './NavList'
import type { NavSection, ShellSite, ShellUser } from './nav'

const ease = [0.22, 1, 0.36, 1] as const

/* Theme -------------------------------------------------------------------------------------- */

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  }, [])
  const toggle = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    document.cookie = `cr-theme=${next}; path=/; max-age=31536000; samesite=lax`
    setTheme(next)
  }, [])
  return { theme, toggle }
}

/* Sign-out: a real form POST, so it works without JavaScript too. */
const signOut = () => (document.getElementById('cr-sign-out') as HTMLFormElement | null)?.requestSubmit()

/* Site switcher (top of the sidebar) ------------------------------------------------------------ */

export function SiteSwitcher({ sites, current }: { sites: ShellSite[]; current?: string }) {
  const site = sites.find((s) => s.slug === current)
  return (
    <Menu.Root>
      <Menu.Trigger className="flex h-10 w-full items-center gap-2.5 rounded-[10px] border border-border bg-surface px-2.5 text-left text-[13px] hover:border-border-strong">
        <span className="flex size-6 items-center justify-center rounded-md bg-accent-soft text-[11px] font-bold text-accent">{(site?.name ?? 'All').slice(0, 1)}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{site?.name ?? 'All sites'}</span>
        <span className="font-mono text-[11px] text-faint">{sites.length}</span>
        <ChevronsUpDown className="size-3.5 text-faint" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} className="z-50 min-w-[220px] rounded-[12px] border border-border bg-surface p-1 shadow-xl">
          <Menu.Label className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">Your sites</Menu.Label>
          <Menu.Item asChild>
            <Link href="/" className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] outline-none data-[highlighted]:bg-surface-2">
              All sites
            </Link>
          </Menu.Item>
          {sites.map((s) => (
            <Menu.Item asChild key={s.slug}>
              <Link href={`/sites/${s.slug}`} className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] outline-none data-[highlighted]:bg-surface-2">
                <Dot tone={toneOf(s.status)} />
                <span className="flex-1 truncate">{s.name}</span>
              </Link>
            </Menu.Item>
          ))}
          {sites.length === 0 && <p className="px-2.5 py-2 text-[12.5px] text-muted">No sites assigned to you yet.</p>}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

/* Command palette (⌘K) -------------------------------------------------------------------------- */

function Palette({ open, onOpenChange, sections, toggleTheme }: { open: boolean; onOpenChange: (v: boolean) => void; sections: NavSection[]; toggleTheme: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const go = (href: string, external?: boolean) => {
    onOpenChange(false)
    if (external) window.location.href = href
    else router.push(href)
  }
  const item = 'flex h-9 cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] text-text data-[selected=true]:bg-surface-2'
  return (
    <Command.Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setQ('')
      }}
      label="Command palette"
      overlayClassName="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]"
      contentClassName="fixed top-[14vh] left-1/2 z-50 w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[16px] border border-border bg-surface shadow-2xl"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4">
        <Search className="size-4 text-faint" aria-hidden />
        <Command.Input value={q} onValueChange={setQ} placeholder="Go to a page, a site, or search records…" className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        <kbd className="rounded border border-border px-1.5 font-mono text-[10.5px] text-faint">esc</kbd>
      </div>
      <Command.List className="cr-scroll max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">Nothing to go to. Press Enter to search records.</Command.Empty>
        {q.trim().length >= 2 && (
          <Command.Group heading="Search" className="px-1 py-1 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase [&_[cmdk-group-items]]:mt-1 [&_[cmdk-group-items]]:normal-case [&_[cmdk-group-items]]:tracking-normal">
            <Command.Item value={`search ${q}`} onSelect={() => go(`/search?q=${encodeURIComponent(q.trim())}`)} className={item}>
              <Search className="size-4 text-faint" aria-hidden />
              <span className="flex-1">
                Search records for “<b>{q.trim()}</b>”
              </span>
              <CornerDownLeft className="size-3.5 text-faint" aria-hidden />
            </Command.Item>
          </Command.Group>
        )}
        {sections.map((section, n) => (
          <Command.Group key={n} heading={section.title ?? 'Go to'} className="px-1 py-1 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase [&_[cmdk-group-items]]:mt-1 [&_[cmdk-group-items]]:normal-case [&_[cmdk-group-items]]:tracking-normal">
            {section.items.map((it) => {
              const Icon = ICONS[it.icon]
              return (
                <Command.Item key={it.href} value={`${section.title ?? ''} ${it.label}`} onSelect={() => go(it.href, it.external)} className={item}>
                  <Icon className="size-4 text-faint" strokeWidth={1.75} aria-hidden />
                  <span className="flex-1">{it.label}</span>
                  {it.dot && <Dot tone={toneOf(it.dot)} />}
                </Command.Item>
              )
            })}
          </Command.Group>
        ))}
        <Command.Group heading="Actions" className="px-1 py-1 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase [&_[cmdk-group-items]]:mt-1 [&_[cmdk-group-items]]:normal-case [&_[cmdk-group-items]]:tracking-normal">
          <Command.Item value="switch theme dark light" onSelect={() => (toggleTheme(), onOpenChange(false))} className={item}>
            <Moon className="size-4 text-faint" aria-hidden />
            Switch light / dark
          </Command.Item>
          <Command.Item value="sign out log out" onSelect={signOut} className={item}>
            <LogOut className="size-4 text-faint" aria-hidden />
            Sign out
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}

/* Ask Ayra (coming soon) ------------------------------------------------------------------------- */

function AskAyra() {
  return (
    <Menu.Root>
      <Menu.Trigger className="hidden h-8 items-center gap-1.5 rounded-[9px] border border-border bg-surface px-2.5 text-[12.5px] font-semibold text-text hover:border-border-strong sm:inline-flex">
        <Sparkles className="size-3.5 text-accent" aria-hidden />
        Ask Ayra
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className="z-50 w-[300px] rounded-[14px] border border-border bg-surface p-4 text-[13px] shadow-xl">
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-accent" aria-hidden /> Ask Ayra is coming
          </p>
          <p className="mt-1.5 text-muted">
            Ask what is live, what is out of date, or which pages cite a claim. Ayra will read and suggest only: it never approves, publishes or syncs.
          </p>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

/* User menu ---------------------------------------------------------------------------------------- */

function UserMenu({ user, theme, toggleTheme }: { user: ShellUser; theme: string; toggleTheme: () => void }) {
  const initial = (user.name || user.email).slice(0, 1).toUpperCase()
  const row = 'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none data-[highlighted]:bg-surface-2'
  return (
    <Menu.Root>
      <Menu.Trigger aria-label="Your account" className="flex size-8 items-center justify-center rounded-full bg-accent-fill text-[13px] font-bold text-accent-fg ring-offset-2 ring-offset-bg hover:ring-2 hover:ring-accent/40">
        {initial}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className="z-50 w-[250px] rounded-[12px] border border-border bg-surface p-1 shadow-xl">
          <div className="px-2.5 py-2">
            <p className="truncate text-[13.5px] font-semibold">{user.name || user.email}</p>
            <p className="truncate text-[12px] text-muted">{user.email}</p>
            <p className="mt-1 text-[11.5px] text-faint">{user.role} · read-only for content</p>
          </div>
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item className={row} onSelect={toggleTheme}>
            {theme === 'dark' ? <Sun className="size-4 text-faint" aria-hidden /> : <Moon className="size-4 text-faint" aria-hidden />}
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </Menu.Item>
          {user.isAdmin && (
            <Menu.Item asChild>
              <a href="/admin" className={row}>
                <KeyRound className="size-4 text-faint" aria-hidden /> Accounts and keys
              </a>
            </Menu.Item>
          )}
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item className={row} onSelect={signOut}>
            <LogOut className="size-4 text-faint" aria-hidden /> Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

/* Phone menu ---------------------------------------------------------------------------------------- */

function PhoneMenu({ sections, active, sites, currentSite }: { sections: NavSection[]; active: string; sites: ShellSite[]; currentSite?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger aria-label="Open menu" className="flex size-9 items-center justify-center rounded-[9px] text-muted hover:bg-surface-2 hover:text-text lg:hidden">
        <MenuIcon className="size-5" aria-hidden />
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-50 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="cr-scroll fixed inset-y-0 left-0 z-50 flex w-[min(300px,86vw)] flex-col gap-5 overflow-y-auto border-r border-border bg-sidebar p-4"
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.18, ease }}
              >
                <div className="flex items-center justify-between">
                  <Dialog.Title asChild>
                    <span>
                      <Logo />
                      <span className="sr-only">Menu</span>
                    </span>
                  </Dialog.Title>
                  <Dialog.Close aria-label="Close menu" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2">
                    <X className="size-4" aria-hidden />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">The control room&apos;s pages and sites.</Dialog.Description>
                <SiteSwitcher sites={sites} current={currentSite} />
                <NavList sections={sections} active={active} onNavigate={() => setOpen(false)} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/* The bar itself -------------------------------------------------------------------------------------- */

export function TopBar({ sections, active, user, sites, currentSite }: { sections: NavSection[]; active: string; user: ShellUser; sites: ShellSite[]; currentSite?: string }) {
  const [open, setOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const opener = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [mac, setMac] = useState(true)
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), [])

  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/85 px-4 backdrop-blur-md sm:px-6">
      <PhoneMenu sections={sections} active={active} sites={sites} currentSite={currentSite} />
      <Link href="/" className="lg:hidden" aria-label="Overview">
        <Logo compact />
      </Link>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto flex h-8 min-w-0 items-center gap-2 rounded-[9px] border border-border bg-surface px-2.5 text-[12.5px] text-faint hover:border-border-strong hover:text-muted sm:w-[min(360px,40vw)] lg:mr-auto lg:ml-0"
        aria-label="Search and go to (⌘K)"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden truncate sm:inline">Search or jump to…</span>
        <kbd className={cn('ml-auto hidden rounded border border-border px-1.5 font-mono text-[10.5px] sm:inline')}>{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <AskAyra />
      <button type="button" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} className="flex size-8 items-center justify-center rounded-[9px] text-muted hover:bg-surface-2 hover:text-text">
        {theme === 'dark' ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      </button>
      <UserMenu user={user} theme={theme} toggleTheme={toggle} />
      <Palette open={open} onOpenChange={setOpen} sections={sections} toggleTheme={toggle} />
    </div>
  )
}

/* Phone dock --------------------------------------------------------------------------------------- */

export function PhoneDock({ active }: { active: string }) {
  const items = [
    { href: '/', label: 'Overview', icon: ICONS.home },
    { href: '/search', label: 'Search', icon: ICONS.search },
    { href: '/receipts', label: 'Receipts', icon: ICONS.receipts },
    { href: '/checks', label: 'Checks', icon: ICONS.checks },
  ]
  return (
    <nav aria-label="Quick links" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={active === href ? 'page' : undefined} className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', active === href ? 'text-accent' : 'text-muted')}>
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  )
}
