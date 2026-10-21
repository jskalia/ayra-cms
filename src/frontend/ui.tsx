/**
 * The control room's building blocks (Phase 10), shadcn-style: small components styled with
 * Tailwind on the design tokens in styles.css. Server-safe (no hooks), so any page can use them.
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx, type ClassValue } from 'clsx'
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-react'
import Link from 'next/link'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/* Status ------------------------------------------------------------------------------------ */

const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'accent'> = {
  ok: 'ok', approved: 'ok', active: 'ok', published: 'ok', public: 'ok', live: 'ok', released: 'ok',
  warn: 'warn', draft: 'warn', internal: 'warn', 'investor-only': 'warn', deprecated: 'warn', preview: 'info', superseded: 'neutral',
  bad: 'bad', failed: 'bad', retired: 'neutral', withdrawn: 'neutral', missing: 'bad',
  info: 'info', unreleased: 'warn',
}
export const toneOf = (value: unknown) => TONE[String(value)] ?? 'neutral'

const badge = cva('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-5 whitespace-nowrap', {
  variants: {
    tone: {
      ok: 'bg-ok-soft text-ok',
      warn: 'bg-warn-soft text-warn',
      bad: 'bg-bad-soft text-bad',
      info: 'bg-info-soft text-info',
      accent: 'bg-accent-soft text-accent',
      neutral: 'bg-surface-2 text-muted',
    },
  },
  defaultVariants: { tone: 'neutral' },
})
export function Badge({ tone, dot, children, className }: VariantProps<typeof badge> & { dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn(badge({ tone }), className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}
/** A status value as a badge, toned by what it means (approved → green, draft → amber…). */
export const StatusBadge = ({ value, tone }: { value: unknown; tone?: VariantProps<typeof badge>['tone'] }) =>
  value === undefined || value === null || value === '' ? <span className="text-faint">—</span> : <Badge tone={tone ?? toneOf(value)}>{String(value)}</Badge>

export const Dot = ({ tone = 'neutral', className }: { tone?: string; className?: string }) => (
  <span
    aria-hidden
    className={cn(
      'inline-block size-2 shrink-0 rounded-full',
      { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-info', accent: 'bg-accent-fill', neutral: 'bg-faint' }[tone] ?? 'bg-faint',
      className,
    )}
  />
)

/* Buttons and fields ------------------------------------------------------------------------ */

export const buttonClass = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] text-[13px] font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent-fill text-accent-fg hover:bg-accent-fill-hover',
        secondary: 'border border-border bg-surface text-text hover:bg-surface-2',
        ghost: 'text-muted hover:bg-surface-2 hover:text-text',
      },
      size: { sm: 'h-8 px-3', md: 'h-9 px-3.5', icon: 'size-9' },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)
export function Button({ variant, size, className, ...props }: ComponentProps<'button'> & VariantProps<typeof buttonClass>) {
  return <button className={cn(buttonClass({ variant, size }), className)} {...props} />
}
export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & VariantProps<typeof buttonClass>) {
  return <Link className={cn(buttonClass({ variant, size }), className)} {...props} />
}

export const fieldClass =
  'h-9 rounded-[10px] border border-border bg-surface px-3 text-[13px] text-text placeholder:text-faint hover:border-border-strong focus:border-accent focus:outline-none'

/* Layout ------------------------------------------------------------------------------------ */

export function Card({ className, children, i, as: As = 'section', ...rest }: { className?: string; children: ReactNode; i?: number; as?: 'section' | 'article' | 'div' | 'aside' } & Omit<ComponentProps<'section'>, 'children' | 'ref'>) {
  return (
    <As className={cn('cr-rise rounded-[14px] border border-border bg-surface shadow-card', className)} style={{ '--i': i ?? 0 } as CSSProperties} {...rest}>
      {children}
    </As>
  )
}
export function CardHeader({ title, icon, action, id, count, plain }: { title: ReactNode; icon?: ReactNode; action?: ReactNode; id?: string; count?: number; plain?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
      <h2 id={id} className={cn('flex items-center gap-2', plain ? 'text-[15px] font-bold' : 'text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase')}>
        {icon && <span className="text-faint [&>svg]:size-4">{icon}</span>}
        {title}
        {count !== undefined && <span className="font-mono text-[11px] text-faint normal-case">{count}</span>}
      </h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, sub, meta, actions, crumbs }: { title: ReactNode; sub?: ReactNode; meta?: ReactNode; actions?: ReactNode; crumbs?: { href?: string; label: string }[] }) {
  return (
    <header className="cr-rise mb-6">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
          {crumbs.map((c, n) => (
            <span key={n} className="flex items-center gap-1.5">
              {n > 0 && <span className="text-faint">/</span>}
              {c.href ? (
                <Link className="hover:text-text" href={c.href}>
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-bold tracking-[-0.02em] break-words">{title}</h1>
          {sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}

/** A number as the hero, in mono, with its label. */
export function Stat({ value, label, href, tone, hint }: { value: ReactNode; label: string; href?: string; tone?: string; hint?: string }) {
  const body = (
    <>
      <span className={cn('font-mono text-[24px] leading-none font-semibold tracking-[-0.03em]', tone && { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' }[tone])}>{value}</span>
      <span className="mt-1.5 text-[12px] text-muted">{label}</span>
      {hint && <span className="mt-0.5 text-[11.5px] text-faint">{hint}</span>}
    </>
  )
  const cls = 'flex flex-col rounded-[10px] px-3 py-2.5'
  return href ? (
    <Link href={href} className={cn(cls, 'hover:bg-surface-2')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-surface-2 text-faint [&>svg]:size-5">{icon ?? <Inbox />}</span>
      <p className="text-[14px] font-semibold">{title}</p>
      {children && <p className="max-w-sm text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** label → value pairs, two columns on wide screens. */
export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 px-4 pb-4 sm:grid-cols-[minmax(110px,160px)_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="pt-0.5 text-[12.5px] text-muted">{k}</dt>
          <dd className="min-w-0 text-[13.5px] break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

/* Tables ------------------------------------------------------------------------------------ */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('cr-scroll overflow-x-auto', className)}>
      <table className="w-full border-separate border-spacing-0 text-[13px]">{children}</table>
    </div>
  )
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th scope="col" className={cn('sticky top-0 z-[1] border-b border-border bg-surface px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap text-muted uppercase first:pl-4 last:pr-4', className)}>
    {children}
  </th>
)
/** A column header that sorts by `field` (asc, then desc) through the page's query string. */
export function SortTh({ label, field, current, href }: { label: string; field: string; current?: string; href: (sort: string) => string }) {
  const dir = current === field ? 'asc' : current === `-${field}` ? 'desc' : undefined
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ChevronsUpDown
  return (
    <Th>
      <Link href={href(dir === 'asc' ? `-${field}` : field)} className="inline-flex items-center gap-1 hover:text-text" aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}>
        {label}
        <Icon className={cn('size-3', !dir && 'opacity-40')} aria-hidden />
      </Link>
    </Th>
  )
}
export const Td = ({ children, className, mono }: { children?: ReactNode; className?: string; mono?: boolean }) => (
  <td className={cn('border-b border-border px-3 py-2.5 align-middle first:pl-4 last:pr-4 group-last:border-b-0', mono && 'font-mono text-[12.5px]', className)}>{children}</td>
)
export const Tr = ({ children }: { children: ReactNode }) => <tr className="group transition-colors hover:bg-surface-2/60">{children}</tr>

/** Previous / next paging through the query string. */
export function Pager({ page, totalPages, totalDocs, href }: { page: number; totalPages: number; totalDocs: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-[12.5px] text-muted">
      <span>
        Page <b className="font-mono text-text">{page}</b> of <span className="font-mono">{totalPages}</span> · <span className="font-mono">{totalDocs}</span> records
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <ButtonLink size="sm" href={href(page - 1)}>
            ← Previous
          </ButtonLink>
        )}
        {page < totalPages && (
          <ButtonLink size="sm" href={href(page + 1)}>
            Next →
          </ButtonLink>
        )}
      </span>
    </nav>
  )
}

export const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn('font-mono text-[12.5px]', className)}>{children}</span>
