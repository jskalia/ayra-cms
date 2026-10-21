'use client'

/** "Wednesday, October 21" and a greeting in the viewer's own time zone. */
export function Greeting({ name }: { name: string }) {
  const now = new Date()
  const hour = now.getHours()
  const part = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = name.trim().split(/\s+/)[0]
  return (
    <div>
      <p className="text-[24px] leading-tight font-bold tracking-[-0.02em] sm:text-[26px]" suppressHydrationWarning>
        {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
      <p className="mt-1 text-[14px] text-white" suppressHydrationWarning>
        {part}
        {first ? `, ${first}` : ''}. Here is what every site holds and what needs you.
      </p>
    </div>
  )
}
