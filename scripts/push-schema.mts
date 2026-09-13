/**
 * Build-time schema push (slai-web pattern).
 *
 * Runs before `next build` on Vercel, where the Neon env vars live. Push is
 * strictly opt-in (PAYLOAD_PUSH_SCHEMA=1) and self-skips everywhere else —
 * local builds and ordinary deploys never touch the schema (outage lesson).
 *
 * Long-term: replace with real migrations once the content model stabilizes.
 */
import { getPayload } from 'payload'

import config from '../payload.config'

async function main(): Promise<void> {
  const flagged = process.env.PAYLOAD_PUSH_SCHEMA === '1'
  const hasDb = Boolean(
    process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL,
  )

  if (!flagged || !hasDb) {
    console.log('[push-schema] skipped (no PAYLOAD_PUSH_SCHEMA=1 or no database env)')
    return
  }

  console.log('[push-schema] running deliberate schema push…')
  const payload = await getPayload({ config })
  console.log('[push-schema] complete')
  await payload.db.destroy()
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[push-schema] FAILED:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
