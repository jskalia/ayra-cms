/**
 * Build-time database migrations: PRODUCTION BUILDS ONLY.
 *
 * Runs before `next build`. On Vercel production builds (VERCEL_ENV=production) it applies
 * the migrations in src/migrations that have not run yet; preview and local builds skip,
 * so a preview can never change the shared database (slai-web outage lesson).
 *
 * Why not just `payload migrate`: if the database was ever schema-pushed, Payload leaves a
 * "dev" marker row (batch -1) in payload_migrations, and `payload migrate` then waits on a
 * yes/no prompt. A build cannot answer it, so the command exits 0 having run nothing and
 * the deploy looks healthy. This runner clears that marker (with a log line), migrates
 * without prompts, then checks every migration is recorded and fails the build if not.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pg = require('pg') as typeof import('pg')

const log = (msg: string) => console.log(`[migrate] ${msg}`)

function connectionString(): string {
  return (
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  )
}

async function clearDevPushMarker(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query<{ exists: string | null }>(
      `SELECT to_regclass('public.payload_migrations') AS exists`,
    )
    if (!rows[0]?.exists) return
    const cleared = await client.query(`DELETE FROM payload_migrations WHERE batch = -1 RETURNING name`)
    if (cleared.rowCount) {
      log(`cleared the dev-push marker (${cleared.rowCount} row) so migrations cannot silently skip`)
    }
  } finally {
    await client.end()
  }
}

async function main(): Promise<number> {
  if (process.env.VERCEL_ENV !== 'production') {
    log(`skipped: not a production build (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'})`)
    return 0
  }
  const url = connectionString()
  if (!url) {
    log('FAILED: production build has no database URL')
    return 1
  }

  await clearDevPushMarker(url)

  // Loaded only here, so skipped (preview/local) builds never need the app's env.
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')
  const { migrations } = await import('../src/migrations')
  const payload = await getPayload({ config, disableOnInit: true }) // never seed users from a build
  await payload.db.migrate({ migrations })

  const { docs } = await payload.find({ collection: 'payload-migrations', limit: 0, pagination: false })
  const recorded = new Set(docs.map((d) => d.name))
  const missing = migrations.map((m) => m.name).filter((name) => !recorded.has(name))
  if (missing.length) {
    log(`FAILED: not recorded after migrating: ${missing.join(', ')}`)
    return 1
  }
  log(`ok: ${migrations.length} migration(s) recorded`)
  return 0
}

// Exit explicitly: open database pools would otherwise keep the build waiting.
main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    log(`FAILED: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    process.exit(1)
  },
)
