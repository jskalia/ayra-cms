/** Shown while a page loads: the shell's outline with placeholder blocks. */
export default function Loading() {
  return (
    <div className="min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[252px_1fr] lg:overflow-hidden" aria-busy="true" aria-label="Loading">
      <div className="hidden h-dvh flex-col gap-4 border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <div className="cr-skeleton h-6 w-32" />
        <div className="cr-skeleton h-10" />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="cr-skeleton h-7" />
        ))}
      </div>
      <div className="flex flex-col lg:h-dvh lg:min-h-0">
        <div className="h-14 shrink-0 border-b border-border" />
        <div className="mx-auto w-full max-w-[1320px] px-4 pt-6 sm:px-6 lg:px-8 lg:[scrollbar-gutter:stable]">
          <div className="cr-skeleton mb-6 h-8 w-64" />
          <div className="cr-skeleton mb-6 h-28 rounded-[18px]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="cr-skeleton h-44 rounded-[14px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
