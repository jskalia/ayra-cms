import Link from 'next/link'

import { Logo } from '../../frontend/shell/Logo'

export const metadata = { title: 'Not found' }

/** A page that does not exist, or a record this person may not see (both look the same). */
export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo compact />
      <h1 className="text-[20px] font-bold">That page isn&apos;t here</h1>
      <p className="max-w-sm text-[14px] text-muted">It may not exist, or it belongs to a site your account can&apos;t see.</p>
      <Link href="/" className="text-[13.5px] font-semibold text-accent hover:underline">
        Back to the overview
      </Link>
    </main>
  )
}
