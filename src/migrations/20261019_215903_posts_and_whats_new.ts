import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Safe to re-run: every statement skips what already exists (scripts/harden-migration.mts).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN CREATE TYPE "public"."enum_posts_visibility" AS ENUM('public', 'internal', 'investor-only'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'approved', 'retired'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_whats_new_regulated_platform_vs_module" AS ENUM('platform', 'module'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_whats_new_features_state" AS ENUM('ga', 'beta', 'internal'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_whats_new_kind" AS ENUM('product-release', 'site-release'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_whats_new_tier" AS ENUM('T1', 'T2', 'T3'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_whats_new_visibility" AS ENUM('public', 'internal', 'investor-only'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_whats_new_status" AS ENUM('draft', 'approved', 'published', 'withdrawn'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_whats_new_source_type" AS ENUM('manual', 'sdd-status', 'pr-merged', 'release-note', 'tag', 'webhook'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  CREATE TABLE IF NOT EXISTS "posts_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  CREATE TABLE IF NOT EXISTS "whats_new_regulated" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"claim" varchar NOT NULL,
  	"k_number" varchar,
  	"platform_vs_module" "enum_whats_new_regulated_platform_vs_module",
  	"fda_signed_by" varchar,
  	"fda_signed_at" varchar
  );
  CREATE TABLE IF NOT EXISTS "whats_new_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"state" "enum_whats_new_features_state" NOT NULL,
  	"claim" varchar
  );
  CREATE TABLE IF NOT EXISTS "whats_new" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"kind" "enum_whats_new_kind" DEFAULT 'product-release' NOT NULL,
  	"product" varchar,
  	"version" varchar,
  	"released_at" timestamp(3) with time zone,
  	"title" varchar,
  	"summary" varchar,
  	"tier" "enum_whats_new_tier",
  	"visibility" "enum_whats_new_visibility" DEFAULT 'internal' NOT NULL,
  	"canonical_url" varchar,
  	"entry" varchar,
  	"status" "enum_whats_new_status" DEFAULT 'draft' NOT NULL,
  	"source_type" "enum_whats_new_source_type",
  	"source_ref" varchar,
  	"source_sha256" varchar,
  	"withheld" jsonb,
  	"channels" jsonb,
  	"approvals_facts_by" varchar,
  	"approvals_facts_at" varchar,
  	"approvals_entry_by" varchar,
  	"approvals_entry_at" varchar,
  	"approvals_entry_version" varchar,
  	"approvals_production_by" varchar,
  	"approvals_production_at" varchar,
  	"receipts" jsonb,
  	"site_release" jsonb,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "whats_new_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "record_id" varchar NOT NULL;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "body" jsonb;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "author_name" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "author_job_title" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "author_url" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "hero_asset" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "seo_title" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "seo_description" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "seo_canonical" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "seo_og" varchar DEFAULT 'auto';
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "seo_noindex" boolean DEFAULT false;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "visibility" "enum_posts_visibility" DEFAULT 'internal' NOT NULL;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "status" "enum_posts_status" DEFAULT 'draft' NOT NULL;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "approved_by" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "approved_at" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "approved_version" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "owner" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "review_by" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sync_source_path" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sync_source_sha256" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sync_receipt" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sync_synced_at" timestamp(3) with time zone;
  DO $$ BEGIN ALTER TABLE "posts_texts" ADD CONSTRAINT "posts_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "whats_new_regulated" ADD CONSTRAINT "whats_new_regulated_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."whats_new"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "whats_new_features" ADD CONSTRAINT "whats_new_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."whats_new"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "whats_new" ADD CONSTRAINT "whats_new_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "whats_new_texts" ADD CONSTRAINT "whats_new_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."whats_new"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "posts_texts_order_parent" ON "posts_texts" USING btree ("order","parent_id");
  CREATE INDEX IF NOT EXISTS "whats_new_regulated_order_idx" ON "whats_new_regulated" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "whats_new_regulated_parent_id_idx" ON "whats_new_regulated" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "whats_new_features_order_idx" ON "whats_new_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "whats_new_features_parent_id_idx" ON "whats_new_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "whats_new_tenant_idx" ON "whats_new" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "whats_new_record_id_idx" ON "whats_new" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "whats_new_released_at_idx" ON "whats_new" USING btree ("released_at");
  CREATE INDEX IF NOT EXISTS "whats_new_updated_at_idx" ON "whats_new" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "whats_new_created_at_idx" ON "whats_new" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_5_idx" ON "whats_new" USING btree ("tenant_id","record_id");
  CREATE INDEX IF NOT EXISTS "whats_new_texts_order_parent" ON "whats_new_texts" USING btree ("order","parent_id");
  CREATE INDEX IF NOT EXISTS "posts_record_id_idx" ON "posts" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "posts_published_at_idx" ON "posts" USING btree ("published_at");
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "whats_new_regulated" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "whats_new_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "whats_new" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "whats_new_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts_texts" CASCADE;
  DROP TABLE "whats_new_regulated" CASCADE;
  DROP TABLE "whats_new_features" CASCADE;
  DROP TABLE "whats_new" CASCADE;
  DROP TABLE "whats_new_texts" CASCADE;
  DROP INDEX "posts_record_id_idx";
  DROP INDEX "posts_published_at_idx";
  ALTER TABLE "posts" DROP COLUMN "record_id";
  ALTER TABLE "posts" DROP COLUMN "body";
  ALTER TABLE "posts" DROP COLUMN "author_name";
  ALTER TABLE "posts" DROP COLUMN "author_job_title";
  ALTER TABLE "posts" DROP COLUMN "author_url";
  ALTER TABLE "posts" DROP COLUMN "hero_asset";
  ALTER TABLE "posts" DROP COLUMN "seo_title";
  ALTER TABLE "posts" DROP COLUMN "seo_description";
  ALTER TABLE "posts" DROP COLUMN "seo_canonical";
  ALTER TABLE "posts" DROP COLUMN "seo_og";
  ALTER TABLE "posts" DROP COLUMN "seo_noindex";
  ALTER TABLE "posts" DROP COLUMN "visibility";
  ALTER TABLE "posts" DROP COLUMN "status";
  ALTER TABLE "posts" DROP COLUMN "approved_by";
  ALTER TABLE "posts" DROP COLUMN "approved_at";
  ALTER TABLE "posts" DROP COLUMN "approved_version";
  ALTER TABLE "posts" DROP COLUMN "owner";
  ALTER TABLE "posts" DROP COLUMN "review_by";
  ALTER TABLE "posts" DROP COLUMN "sync_source_path";
  ALTER TABLE "posts" DROP COLUMN "sync_source_sha256";
  ALTER TABLE "posts" DROP COLUMN "sync_receipt";
  ALTER TABLE "posts" DROP COLUMN "sync_synced_at";
  DROP TYPE "public"."enum_posts_visibility";
  DROP TYPE "public"."enum_posts_status";
  DROP TYPE "public"."enum_whats_new_regulated_platform_vs_module";
  DROP TYPE "public"."enum_whats_new_features_state";
  DROP TYPE "public"."enum_whats_new_kind";
  DROP TYPE "public"."enum_whats_new_tier";
  DROP TYPE "public"."enum_whats_new_visibility";
  DROP TYPE "public"."enum_whats_new_status";
  DROP TYPE "public"."enum_whats_new_source_type";`)
}
