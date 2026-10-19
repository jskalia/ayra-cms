import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Runs Payload-generated CREATE statements so they are safe on a database that
 * already has some of these objects (production was first created by the old
 * hand-written scripts/push-schema.mts, whose tables drifted from Payload's).
 *
 *  1. Types and tables are created; "already exists" errors are skipped.
 *  2. For every CREATE TABLE, any column the table is missing is added
 *     (nullable, no primary key) so existing tables catch up with the model.
 *  3. Indexes and foreign keys are created, again skipping what already exists.
 *
 * It never drops, renames or rewrites anything, so it cannot lose data.
 */
export async function applyIdempotentSql(db: MigrateUpArgs['db'], script: string): Promise<void> {
  const statements = script
    .split(/;\s*\n/)
    .map((s) => s.trim().replace(/;$/, ''))
    .filter(Boolean)

  const run = (statement: string) =>
    db.execute(
      sql.raw(
        `DO $mig$ BEGIN ${statement}; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $mig$`,
      ),
    )

  const isStructure = (s: string) => /^CREATE (TYPE|TABLE) /.test(s)

  // 1. Types and tables first.
  for (const statement of statements.filter(isStructure)) {
    await run(statement)
  }

  // 2. Columns missing from tables that already existed (before any index or key uses them).
  for (const statement of statements) {
    const table = statement.match(/^CREATE TABLE "([^"]+)"\s*\(([\s\S]*)\)$/)
    if (!table) continue
    const [, name, body] = table
    for (const line of body.split('\n')) {
      const column = line.trim().replace(/,$/, '')
      if (!column.startsWith('"')) continue // skips constraints and blank lines
      const definition = column.replace(/\s+PRIMARY KEY/i, '').replace(/\s+NOT NULL/i, '')
      await db.execute(sql.raw(`ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS ${definition}`))
    }
  }

  // 3. Indexes and foreign keys.
  for (const statement of statements.filter((s) => !isStructure(s))) {
    await run(statement)
  }
}
