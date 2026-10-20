import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Safe to re-run: every statement skips what already exists (scripts/harden-migration.mts).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN CREATE TYPE "public"."enum_legal_status" AS ENUM('draft', 'approved', 'published', 'superseded'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_decks_gate" AS ENUM('none', 'investor', 'partner'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_decks_status" AS ENUM('draft', 'approved', 'retired'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_trust_documents_status" AS ENUM('draft', 'approved', 'superseded', 'retired'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_consent_records_region" AS ENUM('us', 'eu-uk', 'other'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_audiences_visibility" AS ENUM('public', 'internal', 'investor-only'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_audiences_status" AS ENUM('active', 'deprecated', 'retired'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_workflows_visibility" AS ENUM('public', 'internal', 'investor-only'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_workflows_status" AS ENUM('active', 'deprecated', 'retired'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  CREATE TABLE IF NOT EXISTS "legal" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"type" varchar NOT NULL,
  	"version" varchar NOT NULL,
  	"effective_at" varchar,
  	"status" "enum_legal_status" DEFAULT 'draft' NOT NULL,
  	"material" boolean DEFAULT false,
  	"change_summary" varchar,
  	"approval_record_id" varchar,
  	"body" jsonb,
  	"body_markdown" varchar,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "decks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"source" varchar,
  	"cover_asset" varchar,
  	"gate" "enum_decks_gate" DEFAULT 'none' NOT NULL,
  	"status" "enum_decks_status" DEFAULT 'draft' NOT NULL,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "trust_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"type" varchar,
  	"version" varchar,
  	"effective_at" varchar,
  	"owner" varchar,
  	"source_sha256" varchar,
  	"status" "enum_trust_documents_status" DEFAULT 'draft' NOT NULL,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "consent_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"anonymous_id" varchar NOT NULL,
  	"choices" jsonb NOT NULL,
  	"policy_version" varchar NOT NULL,
  	"gpc" boolean DEFAULT false,
  	"region" "enum_consent_records_region",
  	"recorded_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "audiences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"summary" varchar,
  	"visibility" "enum_audiences_visibility" DEFAULT 'internal' NOT NULL,
  	"status" "enum_audiences_status" DEFAULT 'active' NOT NULL,
  	"record" jsonb,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "workflows" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"summary" varchar,
  	"visibility" "enum_workflows_visibility" DEFAULT 'internal' NOT NULL,
  	"status" "enum_workflows_status" DEFAULT 'active' NOT NULL,
  	"record" jsonb,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  DO $$ BEGIN ALTER TABLE "legal" ADD CONSTRAINT "legal_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "decks" ADD CONSTRAINT "decks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "trust_documents" ADD CONSTRAINT "trust_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "audiences" ADD CONSTRAINT "audiences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "legal_tenant_idx" ON "legal" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "legal_record_id_idx" ON "legal" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "legal_type_idx" ON "legal" USING btree ("type");
  CREATE INDEX IF NOT EXISTS "legal_updated_at_idx" ON "legal" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "legal_created_at_idx" ON "legal" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_6_idx" ON "legal" USING btree ("tenant_id","record_id");
  CREATE INDEX IF NOT EXISTS "decks_tenant_idx" ON "decks" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "decks_record_id_idx" ON "decks" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "decks_updated_at_idx" ON "decks" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "decks_created_at_idx" ON "decks" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_7_idx" ON "decks" USING btree ("tenant_id","record_id");
  CREATE INDEX IF NOT EXISTS "trust_documents_tenant_idx" ON "trust_documents" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "trust_documents_record_id_idx" ON "trust_documents" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "trust_documents_updated_at_idx" ON "trust_documents" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "trust_documents_created_at_idx" ON "trust_documents" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_8_idx" ON "trust_documents" USING btree ("tenant_id","record_id");
  CREATE INDEX IF NOT EXISTS "consent_records_tenant_idx" ON "consent_records" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "consent_records_anonymous_id_idx" ON "consent_records" USING btree ("anonymous_id");
  CREATE INDEX IF NOT EXISTS "consent_records_recorded_at_idx" ON "consent_records" USING btree ("recorded_at");
  CREATE INDEX IF NOT EXISTS "consent_records_updated_at_idx" ON "consent_records" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "consent_records_created_at_idx" ON "consent_records" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "audiences_tenant_idx" ON "audiences" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "audiences_record_id_idx" ON "audiences" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "audiences_updated_at_idx" ON "audiences" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "audiences_created_at_idx" ON "audiences" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_9_idx" ON "audiences" USING btree ("tenant_id","record_id");
  CREATE INDEX IF NOT EXISTS "workflows_tenant_idx" ON "workflows" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "workflows_record_id_idx" ON "workflows" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "workflows_updated_at_idx" ON "workflows" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "workflows_created_at_idx" ON "workflows" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_10_idx" ON "workflows" USING btree ("tenant_id","record_id");
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "legal" CASCADE;
  DROP TABLE "decks" CASCADE;
  DROP TABLE "trust_documents" CASCADE;
  DROP TABLE "consent_records" CASCADE;
  DROP TABLE "audiences" CASCADE;
  DROP TABLE "workflows" CASCADE;
  DROP TYPE "public"."enum_legal_status";
  DROP TYPE "public"."enum_decks_gate";
  DROP TYPE "public"."enum_decks_status";
  DROP TYPE "public"."enum_trust_documents_status";
  DROP TYPE "public"."enum_consent_records_region";
  DROP TYPE "public"."enum_audiences_visibility";
  DROP TYPE "public"."enum_audiences_status";
  DROP TYPE "public"."enum_workflows_visibility";
  DROP TYPE "public"."enum_workflows_status";`)
}
