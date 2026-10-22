import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '../../../../payload.config'
import { Logo } from '../../../frontend/shell/Logo'
import { tenantIdsOf } from '../../../sync/approval'

export const metadata = { title: 'No sites yet' }

/** Signed in, but no site is assigned to this account yet (new accounts start with none). */
export default async function NoAccess() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const role = (user as { role?: string } | null)?.role
  if (!user || (role !== 'admin' && role !== 'editor')) redirect('/sign-in')
  if (role === 'admin' || tenantIdsOf(user as never).length > 0) redirect('/')

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[24px] border border-border bg-surface/70 p-8 text-center">
        <Logo className="justify-center" />
        <h1 className="mt-8 text-[22px] font-bold tracking-[-0.02em]">You’re signed in, but have no sites yet</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          An admin gives each account the sites it can see. Ask one to add you to a site, then sign in again.
        </p>
        <p className="mt-4 text-[12.5px] text-faint">Signed in as {String((user as { email?: string }).email ?? '')}</p>
        <form action="/sign-out" method="post" className="mt-6">
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-[10px] border border-border bg-surface px-4 text-[13px] font-semibold hover:bg-surface-2">
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
