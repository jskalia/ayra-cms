import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '../../../../payload.config'
import { safeRedirect } from '../../../frontend/safe-redirect'
import { SignIn } from '../../../frontend/SignIn'

export const metadata = { title: 'Sign in' }

/** The control room's sign-in (people only: website and sync accounts use their API keys). */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const next = safeRedirect((await searchParams).redirect)
  const requestHeaders = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: requestHeaders })
  const role = (user as { role?: string } | null)?.role
  if (user && (role === 'admin' || role === 'editor')) redirect(next)
  return <SignIn next={next} />
}
