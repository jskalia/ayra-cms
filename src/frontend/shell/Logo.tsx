import { cn } from '../ui'

/**
 * The control room's brand: the Ayra mark (swapped for the theme; dark files are white, light are ink),
 * with "Ayra CMS" beside it unless `compact`. The AyraAgent wordmark is not used, because this is the CMS.
 */
export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src="/brand/ayraagent-mark-light.svg" alt={compact ? 'Ayra CMS' : ''} className="h-7 w-7 dark:hidden" />
      <img src="/brand/ayraagent-mark-dark.svg" alt={compact ? 'Ayra CMS' : ''} className="hidden h-7 w-7 dark:block" />
      {!compact && <span className="text-[17px] font-bold tracking-[-0.02em]">Ayra CMS</span>}
    </span>
  )
}
