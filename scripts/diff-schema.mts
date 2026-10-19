/**
 * READ-ONLY schema diff: a target database (e.g. production) vs a reference database that
 * was built from scratch by our migrations. Reads table/column definitions only, inside a
 * READ ONLY transaction; it never reads content and never writes.
 *
 *   TARGET_DATABASE_URL=…  REFERENCE_DATABASE_URL=…  npx tsx scripts/diff-schema.mts
 *
 * Exit 0 = no difference; exit 2 = differences listed; exit 1 = error.
 * A person runs it against production (the URL stays in their shell, never in git).
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pg = require('pg') as typeof import('pg')

const COLUMNS = `
  SELECT table_name || '.' || column_name || ' ' || data_type
         || CASE WHEN is_nullable = 'NO' THEN ' not null' ELSE '' END AS col
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY 1`

async function columns(url: string): Promise<Set<string>> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query('BEGIN READ ONLY')
    const { rows } = await client.query<{ col: string }>(COLUMNS)
    await client.query('ROLLBACK')
    return new Set(rows.map((r) => r.col))
  } finally {
    await client.end()
  }
}

async function main(): Promise<number> {
  const target = process.env.TARGET_DATABASE_URL
  const reference = process.env.REFERENCE_DATABASE_URL
  if (!target || !reference) {
    console.error('Set TARGET_DATABASE_URL and REFERENCE_DATABASE_URL.')
    return 1
  }
  const [t, r] = await Promise.all([columns(target), columns(reference)])
  const missing = [...r].filter((c) => !t.has(c))
  const extra = [...t].filter((c) => !r.has(c))
  if (!missing.length && !extra.length) {
    console.log('[diff-schema] no difference')
    return 0
  }
  if (missing.length) console.log(`[diff-schema] missing in target (${missing.length}):\n  ${missing.join('\n  ')}`)
  if (extra.length) console.log(`[diff-schema] only in target (${extra.length}):\n  ${extra.join('\n  ')}`)
  return 2
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`[diff-schema] FAILED: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  },
)
