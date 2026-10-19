import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Safe to re-run: every statement skips what already exists (scripts/harden-migration.mts).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN CREATE TYPE "public"."enum_sync_receipts_status" AS ENUM('ok', 'failed'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  CREATE TABLE IF NOT EXISTS "sync_receipts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"receipt_id" varchar NOT NULL,
  	"revision" numeric NOT NULL,
  	"status" "enum_sync_receipts_status" NOT NULL,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"finished_at" timestamp(3) with time zone NOT NULL,
  	"actor" varchar NOT NULL,
  	"source_root" varchar,
  	"ops_commit" varchar,
  	"counts" jsonb,
  	"items" jsonb,
  	"orphans" jsonb,
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "body_markdown" varchar;
  ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "body_markdown" varchar;
  DO $$ BEGIN ALTER TABLE "sync_receipts" ADD CONSTRAINT "sync_receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "sync_receipts_tenant_idx" ON "sync_receipts" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "sync_receipts_receipt_id_idx" ON "sync_receipts" USING btree ("receipt_id");
  CREATE INDEX IF NOT EXISTS "sync_receipts_updated_at_idx" ON "sync_receipts" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "sync_receipts_created_at_idx" ON "sync_receipts" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_receiptId_idx" ON "sync_receipts" USING btree ("tenant_id","receipt_id");
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "sync_receipts" CASCADE;
  ALTER TABLE "posts" DROP COLUMN "body_markdown";
  ALTER TABLE "pages" DROP COLUMN "body_markdown";
  DROP TYPE "public"."enum_sync_receipts_status";`)
}
