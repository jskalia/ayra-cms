import { cn } from '../ui'

/** The AyraAgent mark and wordmark, swapped for the theme (dark files are white, light are ink). */
export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  const file = compact ? 'mark' : 'logo'
  const size = compact ? 'h-7 w-7' : 'h-[22px] w-auto'
  return (
    <span className={cn('inline-flex items-center', className)}>
      <img src={`/brand/ayraagent-${file}-light.svg`} alt="AyraAgent" className={cn(size, 'dark:hidden')} />
      <img src={`/brand/ayraagent-${file}-dark.svg`} alt="AyraAgent" className={cn(size, 'hidden dark:block')} />
    </span>
  )
}
