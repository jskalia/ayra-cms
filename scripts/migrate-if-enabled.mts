/**
 * Build-time database migrations, still strictly opt-in (slai-web outage lesson).
 *
 * Runs `payload migrate` (applies only the migrations in src/migrations that have
 * not run yet) when PAYLOAD_PUSH_SCHEMA=1 and a database URL exists. Otherwise it
 * skips, so ordinary deploys and local builds never touch the database.
 */
import { spawnSync } from 'node:child_process'

const flagged = process.env.PAYLOAD_PUSH_SCHEMA === '1'
const hasDatabase = Boolean(
  process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL,
)

if (!flagged || !hasDatabase) {
  console.log('[migrate] skipped (no PAYLOAD_PUSH_SCHEMA=1 or no database env)')
  process.exit(0)
}

console.log('[migrate] PAYLOAD_PUSH_SCHEMA=1 — running payload migrate…')
const result = spawnSync('npx', ['payload', 'migrate'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
