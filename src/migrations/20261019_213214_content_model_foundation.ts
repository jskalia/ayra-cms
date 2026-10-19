import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Safe to re-run: every statement skips what already exists (scripts/harden-migration.mts).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_domains_redirects_rule" AS ENUM('keep-path', 'to-path'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_legal_set_counsel" AS ENUM('draft', 'approved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_forms_purpose" AS ENUM('contact', 'demo', 'newsletter', 'whitepaper', 'investor-signup', 'trust-signup'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_status" AS ENUM('draft', 'preview', 'live'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_site_settings_domains_www" AS ENUM('redirect-to-apex', 'serve'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_claims_visibility" AS ENUM('public', 'internal', 'investor-only'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_claims_status" AS ENUM('active', 'deprecated', 'retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_claims_platform_vs_module" AS ENUM('platform', 'module', 'n/a'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_atoms_kind" AS ENUM('diagram', 'card', 'platform_map', 'workflow', 'table', 'faq', 'metric', 'quote'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_atoms_recipe" AS ENUM('R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_atoms_visibility" AS ENUM('public', 'internal', 'investor-only'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_atoms_status" AS ENUM('active', 'deprecated', 'retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_media_kind" AS ENUM('og', 'square', 'portrait', 'story', 'email', 'slide-16x9', 'section', 'screen', 'diagram', 'logo', 'photo', 'video'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_media_status" AS ENUM('draft', 'approved', 'retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE TABLE IF NOT EXISTS "site_settings_domains_redirects" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"domain" varchar NOT NULL,
  	"rule" "enum_site_settings_domains_redirects_rule" NOT NULL,
  	"target" varchar
  );
  CREATE TABLE IF NOT EXISTS "site_settings_legal_set" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" varchar NOT NULL,
  	"page" varchar,
  	"version" varchar,
  	"counsel" "enum_site_settings_legal_set_counsel" DEFAULT 'draft',
  	"generated_from" varchar
  );
  CREATE TABLE IF NOT EXISTS "site_settings_forms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"form_id" varchar NOT NULL,
  	"purpose" "enum_site_settings_forms_purpose",
  	"inbox" varchar,
  	"inbox_owner" varchar,
  	"sla_hours" numeric,
  	"confirmation_email" boolean,
  	"send_adapter" varchar,
  	"notice_at_collection" varchar,
  	"asks_health_information" boolean DEFAULT false
  );
  CREATE TABLE IF NOT EXISTS "site_settings_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel_id" varchar NOT NULL,
  	"url" varchar,
  	"owner" varchar
  );
  CREATE TABLE IF NOT EXISTS "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"org" varchar NOT NULL,
  	"brand" varchar,
  	"status" "enum_site_settings_status" DEFAULT 'draft' NOT NULL,
  	"look" varchar DEFAULT 'house-style',
  	"domains_primary" varchar,
  	"domains_www" "enum_site_settings_domains_www" DEFAULT 'redirect-to-apex',
  	"kit_path" varchar,
  	"kit_section" varchar,
  	"kit_system_id" varchar,
  	"kit_version" varchar,
  	"kit_approved" boolean DEFAULT false,
  	"nav" jsonb,
  	"nav_cta" jsonb,
  	"footer" jsonb,
  	"consent_register" varchar,
  	"consent_notice" varchar,
  	"consent_defaults" jsonb,
  	"consent_policy_version" varchar,
  	"ui" jsonb,
  	"modules" jsonb,
  	"owners" jsonb,
  	"approvers" jsonb,
  	"redesign" jsonb,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "site_settings_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  CREATE TABLE IF NOT EXISTS "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"released" boolean DEFAULT false NOT NULL,
  	"status" varchar,
  	"record" jsonb,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "claims" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"entity" varchar,
  	"text" varchar NOT NULL,
  	"source_path" varchar NOT NULL,
  	"source_line_or_section" varchar NOT NULL,
  	"source_pinned_date" varchar NOT NULL,
  	"source_commit" varchar,
  	"sha256" varchar NOT NULL,
  	"quote" varchar NOT NULL,
  	"visibility" "enum_claims_visibility" DEFAULT 'internal' NOT NULL,
  	"visibility_note" varchar,
  	"status" "enum_claims_status" DEFAULT 'active' NOT NULL,
  	"regulated" boolean DEFAULT false NOT NULL,
  	"k_number" varchar,
  	"platform_vs_module" "enum_claims_platform_vs_module",
  	"product" varchar,
  	"fda_view_signed_by" varchar,
  	"fda_view_signed_at" varchar,
  	"approved_by" varchar NOT NULL,
  	"approved_at" varchar NOT NULL,
  	"superseded_by" varchar,
  	"note" varchar,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "atoms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"version" numeric,
  	"kind" "enum_atoms_kind",
  	"recipe" "enum_atoms_recipe",
  	"title" varchar,
  	"visibility" "enum_atoms_visibility" DEFAULT 'internal' NOT NULL,
  	"visibility_note" varchar,
  	"status" "enum_atoms_status" DEFAULT 'active' NOT NULL,
  	"shape" jsonb,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "atoms_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "record_id" varchar NOT NULL;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "kind" "enum_media_kind" NOT NULL;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "status" "enum_media_status" DEFAULT 'draft' NOT NULL;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sha256" varchar;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "licence" varchar;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "attribution" varchar;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "consent" varchar;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sync_source_path" varchar;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sync_source_sha256" varchar;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sync_receipt" varchar;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sync_synced_at" timestamp(3) with time zone;
  DO $$ BEGIN ALTER TABLE "site_settings_domains_redirects" ADD CONSTRAINT "site_settings_domains_redirects_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "site_settings_legal_set" ADD CONSTRAINT "site_settings_legal_set_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "site_settings_forms" ADD CONSTRAINT "site_settings_forms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "site_settings_channels" ADD CONSTRAINT "site_settings_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "site_settings_texts" ADD CONSTRAINT "site_settings_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "claims" ADD CONSTRAINT "claims_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "atoms" ADD CONSTRAINT "atoms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "atoms_texts" ADD CONSTRAINT "atoms_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."atoms"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "site_settings_domains_redirects_order_idx" ON "site_settings_domains_redirects" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "site_settings_domains_redirects_parent_id_idx" ON "site_settings_domains_redirects" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "site_settings_legal_set_order_idx" ON "site_settings_legal_set" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "site_settings_legal_set_parent_id_idx" ON "site_settings_legal_set" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "site_settings_forms_order_idx" ON "site_settings_forms" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "site_settings_forms_parent_id_idx" ON "site_settings_forms" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "site_settings_channels_order_idx" ON "site_settings_channels" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "site_settings_channels_parent_id_idx" ON "site_settings_channels" USING btree ("_parent_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "site_settings_tenant_idx" ON "site_settings" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "site_settings_record_id_idx" ON "site_settings" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "site_settings_updated_at_idx" ON "site_settings" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "site_settings_created_at_idx" ON "site_settings" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "site_settings_texts_order_parent" ON "site_settings_texts" USING btree ("order","parent_id");
  CREATE INDEX IF NOT EXISTS "products_tenant_idx" ON "products" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "products_record_id_idx" ON "products" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_idx" ON "products" USING btree ("tenant_id","record_id");
  CREATE INDEX IF NOT EXISTS "claims_tenant_idx" ON "claims" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "claims_record_id_idx" ON "claims" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "claims_updated_at_idx" ON "claims" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "claims_created_at_idx" ON "claims" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_1_idx" ON "claims" USING btree ("tenant_id","record_id");
  CREATE INDEX IF NOT EXISTS "atoms_tenant_idx" ON "atoms" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "atoms_record_id_idx" ON "atoms" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "atoms_updated_at_idx" ON "atoms" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "atoms_created_at_idx" ON "atoms" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_2_idx" ON "atoms" USING btree ("tenant_id","record_id");
  CREATE INDEX IF NOT EXISTS "atoms_texts_order_parent" ON "atoms_texts" USING btree ("order","parent_id");
  CREATE INDEX IF NOT EXISTS "media_record_id_idx" ON "media" USING btree ("record_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_3_idx" ON "media" USING btree ("tenant_id","record_id");
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_domains_redirects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_legal_set" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_forms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_channels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claims" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "atoms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "atoms_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "site_settings_domains_redirects" CASCADE;
  DROP TABLE "site_settings_legal_set" CASCADE;
  DROP TABLE "site_settings_forms" CASCADE;
  DROP TABLE "site_settings_channels" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "site_settings_texts" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "claims" CASCADE;
  DROP TABLE "atoms" CASCADE;
  DROP TABLE "atoms_texts" CASCADE;
  DROP INDEX "media_record_id_idx";
  DROP INDEX "tenant_recordId_3_idx";
  ALTER TABLE "media" DROP COLUMN "record_id";
  ALTER TABLE "media" DROP COLUMN "kind";
  ALTER TABLE "media" DROP COLUMN "status";
  ALTER TABLE "media" DROP COLUMN "sha256";
  ALTER TABLE "media" DROP COLUMN "licence";
  ALTER TABLE "media" DROP COLUMN "attribution";
  ALTER TABLE "media" DROP COLUMN "consent";
  ALTER TABLE "media" DROP COLUMN "sync_source_path";
  ALTER TABLE "media" DROP COLUMN "sync_source_sha256";
  ALTER TABLE "media" DROP COLUMN "sync_receipt";
  ALTER TABLE "media" DROP COLUMN "sync_synced_at";
  DROP TYPE "public"."enum_site_settings_domains_redirects_rule";
  DROP TYPE "public"."enum_site_settings_legal_set_counsel";
  DROP TYPE "public"."enum_site_settings_forms_purpose";
  DROP TYPE "public"."enum_site_settings_status";
  DROP TYPE "public"."enum_site_settings_domains_www";
  DROP TYPE "public"."enum_claims_visibility";
  DROP TYPE "public"."enum_claims_status";
  DROP TYPE "public"."enum_claims_platform_vs_module";
  DROP TYPE "public"."enum_atoms_kind";
  DROP TYPE "public"."enum_atoms_recipe";
  DROP TYPE "public"."enum_atoms_visibility";
  DROP TYPE "public"."enum_atoms_status";
  DROP TYPE "public"."enum_media_kind";
  DROP TYPE "public"."enum_media_status";`)
}
