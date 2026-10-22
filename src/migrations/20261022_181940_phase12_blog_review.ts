import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Safe to re-run: every statement skips what already exists (scripts/harden-migration.mts).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "review_state" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "review_revision" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "review_previously_approved" boolean DEFAULT false;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "review_decided_by" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "review_decided_at" varchar;
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DROP COLUMN "review_state";
  ALTER TABLE "posts" DROP COLUMN "review_revision";
  ALTER TABLE "posts" DROP COLUMN "review_previously_approved";
  ALTER TABLE "posts" DROP COLUMN "review_decided_by";
  ALTER TABLE "posts" DROP COLUMN "review_decided_at";`)
}
