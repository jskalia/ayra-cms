import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Safe to re-run: every statement skips what already exists (scripts/harden-migration.mts).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE IF EXISTS "posts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "_posts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "_posts_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "authors" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "posts_rels" CASCADE;
  DROP TABLE IF EXISTS "_posts_v" CASCADE;
  DROP TABLE IF EXISTS "_posts_v_rels" CASCADE;
  DROP TABLE IF EXISTS "categories" CASCADE;
  DROP TABLE IF EXISTS "authors" CASCADE;
  ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_featured_image_id_media_id_fk";
  DROP INDEX IF EXISTS "posts_featured_image_idx";
  DROP INDEX IF EXISTS "posts__status_idx";
  ALTER TABLE "posts" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "posts" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "pages_blocks_hero_statement" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_media_panel" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_icon_chip_rail" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_statement" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_feature_explorer" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_product_grid" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_capability_trio" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_proof_numbers" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_clearance_strip" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_screens" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_workflow_diagram" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_platform_map" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_logo_wall" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_quote" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_timeline" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_audience_showcase" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_split_cta" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_contact_form" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_newsletter" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_faq" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_card_feed" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_article_body" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_deck_embed" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_episode_player" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_gated_sign_in" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_document_list" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_legal_body" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "pages_blocks_error_page" ALTER COLUMN "props" SET NOT NULL;
  ALTER TABLE "posts" DROP COLUMN "content";
  ALTER TABLE "posts" DROP COLUMN "featured_image_id";
  ALTER TABLE "posts" DROP COLUMN "meta_description";
  ALTER TABLE "posts" DROP COLUMN "_status";
  DROP TYPE IF EXISTS "public"."enum_posts_status";
  DROP TYPE IF EXISTS "public"."enum__posts_v_version_status";
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"authors_id" integer
  );
  
  CREATE TABLE "_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tenant_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"version_featured_image_id" integer,
  	"version_published_at" timestamp(3) with time zone,
  	"version_meta_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_posts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"authors_id" integer
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "authors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"title" varchar,
  	"photo_id" integer,
  	"bio" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "posts" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "posts" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "pages_blocks_hero_statement" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_media_panel" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_icon_chip_rail" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_statement" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_feature_explorer" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_product_grid" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_capability_trio" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_proof_numbers" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_clearance_strip" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_screens" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_workflow_diagram" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_platform_map" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_logo_wall" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_quote" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_timeline" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_audience_showcase" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_split_cta" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_contact_form" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_newsletter" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_faq" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_card_feed" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_article_body" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_deck_embed" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_episode_player" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_gated_sign_in" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_document_list" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_legal_body" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "pages_blocks_error_page" ALTER COLUMN "props" DROP NOT NULL;
  ALTER TABLE "posts" ADD COLUMN "content" jsonb;
  ALTER TABLE "posts" ADD COLUMN "featured_image_id" integer;
  ALTER TABLE "posts" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "posts" ADD COLUMN "_status" "enum_posts_status" DEFAULT 'draft';
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_featured_image_id_media_id_fk" FOREIGN KEY ("version_featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "authors" ADD CONSTRAINT "authors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "authors" ADD CONSTRAINT "authors_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "posts_rels_order_idx" ON "posts_rels" USING btree ("order");
  CREATE INDEX "posts_rels_parent_idx" ON "posts_rels" USING btree ("parent_id");
  CREATE INDEX "posts_rels_path_idx" ON "posts_rels" USING btree ("path");
  CREATE INDEX "posts_rels_categories_id_idx" ON "posts_rels" USING btree ("categories_id");
  CREATE INDEX "posts_rels_authors_id_idx" ON "posts_rels" USING btree ("authors_id");
  CREATE INDEX "_posts_v_parent_idx" ON "_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_tenant_idx" ON "_posts_v" USING btree ("version_tenant_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_featured_image_idx" ON "_posts_v" USING btree ("version_featured_image_id");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "_posts_v" USING btree ("latest");
  CREATE INDEX "version_tenant_version_slug_idx" ON "_posts_v" USING btree ("version_tenant_id","version_slug");
  CREATE INDEX "_posts_v_rels_order_idx" ON "_posts_v_rels" USING btree ("order");
  CREATE INDEX "_posts_v_rels_parent_idx" ON "_posts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_posts_v_rels_path_idx" ON "_posts_v_rels" USING btree ("path");
  CREATE INDEX "_posts_v_rels_categories_id_idx" ON "_posts_v_rels" USING btree ("categories_id");
  CREATE INDEX "_posts_v_rels_authors_id_idx" ON "_posts_v_rels" USING btree ("authors_id");
  CREATE INDEX "categories_tenant_idx" ON "categories" USING btree ("tenant_id");
  CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenant_slug_1_idx" ON "categories" USING btree ("tenant_id","slug");
  CREATE INDEX "authors_tenant_idx" ON "authors" USING btree ("tenant_id");
  CREATE INDEX "authors_photo_idx" ON "authors" USING btree ("photo_id");
  CREATE INDEX "authors_updated_at_idx" ON "authors" USING btree ("updated_at");
  CREATE INDEX "authors_created_at_idx" ON "authors" USING btree ("created_at");
  ALTER TABLE "posts" ADD CONSTRAINT "posts_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "posts_featured_image_idx" ON "posts" USING btree ("featured_image_id");
  CREATE INDEX "posts__status_idx" ON "posts" USING btree ("_status");`)
}
