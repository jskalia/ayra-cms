import type { Payload } from 'payload'

/**
 * One-time admin bootstrap, for when nobody can sign in (2026-10-20: the only account was
 * auto-created from env vars whose password nobody kept).
 *
 * A person sets PAYLOAD_BOOTSTRAP_ADMIN_EMAIL and PAYLOAD_BOOTSTRAP_ADMIN_PASSWORD in Vercel,
 * deploys, signs in, then deletes both variables. With the variables unset it does nothing.
 * It only ever CREATES an account for an email that does not exist yet: it never changes an
 * existing account's password or role, so it cannot be used to take over an account.
 */
export type BootstrapResult = 'not-configured' | 'too-short' | 'exists' | 'created'

export async function bootstrapAdmin(
  payload: Payload,
  { email, password }: { email?: string; password?: string },
): Promise<BootstrapResult> {
  if (!email || !password) return 'not-configured'
  if (password.length < 12) {
    payload.logger.warn('[bootstrap-admin] skipped: the password must be at least 12 characters')
    return 'too-short'
  }
  const existing = await payload.count({ collection: 'users', where: { email: { equals: email.toLowerCase() } } })
  if (existing.totalDocs > 0) {
    payload.logger.info(`[bootstrap-admin] skipped: ${email} already has an account (left unchanged). Remove the bootstrap variables.`)
    return 'exists'
  }
  await payload.create({
    collection: 'users',
    data: { email, password, name: email.split('@')[0], role: 'admin' } as never,
  })
  payload.logger.info(`[bootstrap-admin] created admin account ${email}. Sign in, then remove the bootstrap variables.`)
  return 'created'
}
