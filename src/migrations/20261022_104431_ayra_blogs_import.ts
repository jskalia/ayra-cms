import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Safe to re-run: every statement skips what already exists (scripts/harden-migration.mts).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN CREATE TYPE "public"."enum_posts_origin" AS ENUM('ops', 'ayra-blogs'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ayra_blogs_org" varchar;
  ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ayra_blogs_token_env" varchar;
  ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ayra_blogs_author_name" varchar;
  ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ayra_blogs_author_job_title" varchar;
  ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ayra_blogs_author_url" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "origin" "enum_posts_origin" DEFAULT 'ops';
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "external_id" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sources" jsonb;
  CREATE INDEX IF NOT EXISTS "posts_external_id_idx" ON "posts" USING btree ("external_id");
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "posts_external_id_idx";
  ALTER TABLE "tenants" DROP COLUMN "ayra_blogs_org";
  ALTER TABLE "tenants" DROP COLUMN "ayra_blogs_token_env";
  ALTER TABLE "tenants" DROP COLUMN "ayra_blogs_author_name";
  ALTER TABLE "tenants" DROP COLUMN "ayra_blogs_author_job_title";
  ALTER TABLE "tenants" DROP COLUMN "ayra_blogs_author_url";
  ALTER TABLE "posts" DROP COLUMN "origin";
  ALTER TABLE "posts" DROP COLUMN "external_id";
  ALTER TABLE "posts" DROP COLUMN "sources";
  DROP TYPE "public"."enum_posts_origin";`)
}
