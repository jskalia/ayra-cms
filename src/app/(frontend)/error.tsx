'use client'

import { RotateCw } from 'lucide-react'

/** Something failed while loading a page (for example the database was briefly unreachable). */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-[20px] font-bold">This page didn&apos;t load</h1>
      <p className="max-w-sm text-[14px] text-muted">Nothing was changed. Try again; if it keeps happening, the CMS may be restarting.</p>
      <button type="button" onClick={reset} className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-accent-fill px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-fill-hover">
        <RotateCw className="size-4" aria-hidden /> Try again
      </button>
    </main>
  )
}
