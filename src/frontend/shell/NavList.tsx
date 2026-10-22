'use client'

import Link from 'next/link'

import { cn, Dot, toneOf } from '../ui'
import { ICONS } from './icons'
import type { NavSection } from './nav'

/** The sidebar's sections and links (also used in the phone menu). */
export function NavList({ sections, active, onNavigate }: { sections: NavSection[]; active: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Control room" className="flex flex-col gap-5">
      {sections.map((section, n) => (
        <div key={n} className="flex flex-col gap-0.5">
          {section.title && <h2 className="px-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.09em] text-faint uppercase">{section.title}</h2>}
          {section.items.map((item) => {
            const Icon = ICONS[item.icon]
            const current = active === item.href
            const cls = cn(
              'group flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[13.5px] font-medium transition-colors',
              current ? 'bg-accent-fill text-accent-fg' : 'text-muted hover:bg-surface-2 hover:text-text',
            )
            const body = (
              <>
                <Icon className={cn('size-[17px] shrink-0', current ? 'text-accent-fg' : 'text-faint group-hover:text-text')} strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className={cn('min-w-5 rounded-full px-1.5 text-center font-mono text-[11px] leading-5 font-semibold', current ? 'bg-white/20 text-accent-fg' : 'bg-warn-soft text-warn')}>{item.badge}</span>
                ) : null}
                {item.dot && <Dot tone={toneOf(item.dot)} className={current ? 'ring-2 ring-accent-fg/40' : undefined} />}
              </>
            )
            return item.external ? (
              <a key={item.href} href={item.href} className={cls} onClick={onNavigate}>
                {body}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className={cls} aria-current={current ? 'page' : undefined} onClick={onNavigate}>
                {body}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
