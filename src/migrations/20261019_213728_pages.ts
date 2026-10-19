import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Safe to re-run: every statement skips what already exists (scripts/harden-migration.mts).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN CREATE TYPE "public"."enum_pages_template" AS ENUM('platform-home', 'solution-path', 'product', 'products-hub', 'platform', 'proof', 'article', 'whats-new-entry', 'deck', 'episode', 'portal', 'trust-center', 'legal', 'contact', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_pages_visibility" AS ENUM('public', 'internal', 'investor-only'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_pages_gate" AS ENUM('none', 'investor', 'trust', 'partner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'approved', 'retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE TABLE IF NOT EXISTS "pages_blocks_hero_statement" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_media_panel" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_icon_chip_rail" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_statement" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_feature_explorer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_product_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_capability_trio" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_proof_numbers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_clearance_strip" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_screens" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_workflow_diagram" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_platform_map" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_logo_wall" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_quote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_audience_showcase" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_split_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_contact_form" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_newsletter" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_card_feed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_article_body" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_deck_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_episode_player" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_gated_sign_in" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_document_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_legal_body" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages_blocks_error_page" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"props" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"record_id" varchar NOT NULL,
  	"template" "enum_pages_template" NOT NULL,
  	"route" varchar NOT NULL,
  	"product" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_canonical" varchar,
  	"seo_og" varchar DEFAULT 'auto',
  	"seo_sitemap" boolean DEFAULT true,
  	"seo_llms_txt" boolean DEFAULT true,
  	"seo_noindex" boolean DEFAULT false,
  	"visibility" "enum_pages_visibility" DEFAULT 'internal' NOT NULL,
  	"gate" "enum_pages_gate" DEFAULT 'none' NOT NULL,
  	"owner" varchar,
  	"review_by" varchar,
  	"status" "enum_pages_status" DEFAULT 'draft' NOT NULL,
  	"approved_by" varchar,
  	"approved_at" varchar,
  	"approved_version" varchar,
  	"body" jsonb,
  	"sync_source_path" varchar,
  	"sync_source_sha256" varchar,
  	"sync_receipt" varchar,
  	"sync_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "pages_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  DO $$ BEGIN ALTER TABLE "pages_blocks_hero_statement" ADD CONSTRAINT "pages_blocks_hero_statement_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_media_panel" ADD CONSTRAINT "pages_blocks_media_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_icon_chip_rail" ADD CONSTRAINT "pages_blocks_icon_chip_rail_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_statement" ADD CONSTRAINT "pages_blocks_statement_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_feature_explorer" ADD CONSTRAINT "pages_blocks_feature_explorer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_product_grid" ADD CONSTRAINT "pages_blocks_product_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_capability_trio" ADD CONSTRAINT "pages_blocks_capability_trio_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_proof_numbers" ADD CONSTRAINT "pages_blocks_proof_numbers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_clearance_strip" ADD CONSTRAINT "pages_blocks_clearance_strip_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_screens" ADD CONSTRAINT "pages_blocks_screens_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_workflow_diagram" ADD CONSTRAINT "pages_blocks_workflow_diagram_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_platform_map" ADD CONSTRAINT "pages_blocks_platform_map_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_logo_wall" ADD CONSTRAINT "pages_blocks_logo_wall_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_quote" ADD CONSTRAINT "pages_blocks_quote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_timeline" ADD CONSTRAINT "pages_blocks_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_audience_showcase" ADD CONSTRAINT "pages_blocks_audience_showcase_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_split_cta" ADD CONSTRAINT "pages_blocks_split_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_contact_form" ADD CONSTRAINT "pages_blocks_contact_form_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_newsletter" ADD CONSTRAINT "pages_blocks_newsletter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_faq" ADD CONSTRAINT "pages_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_card_feed" ADD CONSTRAINT "pages_blocks_card_feed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_article_body" ADD CONSTRAINT "pages_blocks_article_body_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_deck_embed" ADD CONSTRAINT "pages_blocks_deck_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_episode_player" ADD CONSTRAINT "pages_blocks_episode_player_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_gated_sign_in" ADD CONSTRAINT "pages_blocks_gated_sign_in_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_document_list" ADD CONSTRAINT "pages_blocks_document_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_legal_body" ADD CONSTRAINT "pages_blocks_legal_body_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_blocks_error_page" ADD CONSTRAINT "pages_blocks_error_page_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "pages_texts" ADD CONSTRAINT "pages_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "pages_blocks_hero_statement_order_idx" ON "pages_blocks_hero_statement" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_hero_statement_parent_id_idx" ON "pages_blocks_hero_statement" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_hero_statement_path_idx" ON "pages_blocks_hero_statement" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_media_panel_order_idx" ON "pages_blocks_media_panel" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_media_panel_parent_id_idx" ON "pages_blocks_media_panel" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_media_panel_path_idx" ON "pages_blocks_media_panel" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_icon_chip_rail_order_idx" ON "pages_blocks_icon_chip_rail" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_icon_chip_rail_parent_id_idx" ON "pages_blocks_icon_chip_rail" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_icon_chip_rail_path_idx" ON "pages_blocks_icon_chip_rail" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_statement_order_idx" ON "pages_blocks_statement" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_statement_parent_id_idx" ON "pages_blocks_statement" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_statement_path_idx" ON "pages_blocks_statement" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_feature_explorer_order_idx" ON "pages_blocks_feature_explorer" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_feature_explorer_parent_id_idx" ON "pages_blocks_feature_explorer" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_feature_explorer_path_idx" ON "pages_blocks_feature_explorer" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_product_grid_order_idx" ON "pages_blocks_product_grid" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_product_grid_parent_id_idx" ON "pages_blocks_product_grid" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_product_grid_path_idx" ON "pages_blocks_product_grid" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_capability_trio_order_idx" ON "pages_blocks_capability_trio" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_capability_trio_parent_id_idx" ON "pages_blocks_capability_trio" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_capability_trio_path_idx" ON "pages_blocks_capability_trio" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_proof_numbers_order_idx" ON "pages_blocks_proof_numbers" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_proof_numbers_parent_id_idx" ON "pages_blocks_proof_numbers" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_proof_numbers_path_idx" ON "pages_blocks_proof_numbers" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_clearance_strip_order_idx" ON "pages_blocks_clearance_strip" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_clearance_strip_parent_id_idx" ON "pages_blocks_clearance_strip" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_clearance_strip_path_idx" ON "pages_blocks_clearance_strip" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_screens_order_idx" ON "pages_blocks_screens" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_screens_parent_id_idx" ON "pages_blocks_screens" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_screens_path_idx" ON "pages_blocks_screens" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_workflow_diagram_order_idx" ON "pages_blocks_workflow_diagram" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_workflow_diagram_parent_id_idx" ON "pages_blocks_workflow_diagram" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_workflow_diagram_path_idx" ON "pages_blocks_workflow_diagram" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_platform_map_order_idx" ON "pages_blocks_platform_map" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_platform_map_parent_id_idx" ON "pages_blocks_platform_map" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_platform_map_path_idx" ON "pages_blocks_platform_map" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_logo_wall_order_idx" ON "pages_blocks_logo_wall" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_logo_wall_parent_id_idx" ON "pages_blocks_logo_wall" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_logo_wall_path_idx" ON "pages_blocks_logo_wall" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_quote_order_idx" ON "pages_blocks_quote" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_quote_parent_id_idx" ON "pages_blocks_quote" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_quote_path_idx" ON "pages_blocks_quote" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_timeline_order_idx" ON "pages_blocks_timeline" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_timeline_parent_id_idx" ON "pages_blocks_timeline" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_timeline_path_idx" ON "pages_blocks_timeline" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_audience_showcase_order_idx" ON "pages_blocks_audience_showcase" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_audience_showcase_parent_id_idx" ON "pages_blocks_audience_showcase" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_audience_showcase_path_idx" ON "pages_blocks_audience_showcase" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_split_cta_order_idx" ON "pages_blocks_split_cta" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_split_cta_parent_id_idx" ON "pages_blocks_split_cta" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_split_cta_path_idx" ON "pages_blocks_split_cta" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_contact_form_order_idx" ON "pages_blocks_contact_form" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_contact_form_parent_id_idx" ON "pages_blocks_contact_form" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_contact_form_path_idx" ON "pages_blocks_contact_form" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_newsletter_order_idx" ON "pages_blocks_newsletter" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_newsletter_parent_id_idx" ON "pages_blocks_newsletter" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_newsletter_path_idx" ON "pages_blocks_newsletter" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_faq_order_idx" ON "pages_blocks_faq" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_faq_parent_id_idx" ON "pages_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_faq_path_idx" ON "pages_blocks_faq" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_card_feed_order_idx" ON "pages_blocks_card_feed" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_card_feed_parent_id_idx" ON "pages_blocks_card_feed" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_card_feed_path_idx" ON "pages_blocks_card_feed" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_article_body_order_idx" ON "pages_blocks_article_body" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_article_body_parent_id_idx" ON "pages_blocks_article_body" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_article_body_path_idx" ON "pages_blocks_article_body" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_deck_embed_order_idx" ON "pages_blocks_deck_embed" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_deck_embed_parent_id_idx" ON "pages_blocks_deck_embed" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_deck_embed_path_idx" ON "pages_blocks_deck_embed" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_episode_player_order_idx" ON "pages_blocks_episode_player" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_episode_player_parent_id_idx" ON "pages_blocks_episode_player" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_episode_player_path_idx" ON "pages_blocks_episode_player" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_gated_sign_in_order_idx" ON "pages_blocks_gated_sign_in" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_gated_sign_in_parent_id_idx" ON "pages_blocks_gated_sign_in" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_gated_sign_in_path_idx" ON "pages_blocks_gated_sign_in" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_document_list_order_idx" ON "pages_blocks_document_list" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_document_list_parent_id_idx" ON "pages_blocks_document_list" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_document_list_path_idx" ON "pages_blocks_document_list" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_legal_body_order_idx" ON "pages_blocks_legal_body" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_legal_body_parent_id_idx" ON "pages_blocks_legal_body" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_legal_body_path_idx" ON "pages_blocks_legal_body" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_error_page_order_idx" ON "pages_blocks_error_page" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_error_page_parent_id_idx" ON "pages_blocks_error_page" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_error_page_path_idx" ON "pages_blocks_error_page" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_tenant_idx" ON "pages" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "pages_record_id_idx" ON "pages" USING btree ("record_id");
  CREATE INDEX IF NOT EXISTS "pages_route_idx" ON "pages" USING btree ("route");
  CREATE INDEX IF NOT EXISTS "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_recordId_4_idx" ON "pages" USING btree ("tenant_id","record_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_route_idx" ON "pages" USING btree ("tenant_id","route");
  CREATE INDEX IF NOT EXISTS "pages_texts_order_parent" ON "pages_texts" USING btree ("order","parent_id");
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages_blocks_hero_statement" CASCADE;
  DROP TABLE "pages_blocks_media_panel" CASCADE;
  DROP TABLE "pages_blocks_icon_chip_rail" CASCADE;
  DROP TABLE "pages_blocks_statement" CASCADE;
  DROP TABLE "pages_blocks_feature_explorer" CASCADE;
  DROP TABLE "pages_blocks_product_grid" CASCADE;
  DROP TABLE "pages_blocks_capability_trio" CASCADE;
  DROP TABLE "pages_blocks_proof_numbers" CASCADE;
  DROP TABLE "pages_blocks_clearance_strip" CASCADE;
  DROP TABLE "pages_blocks_screens" CASCADE;
  DROP TABLE "pages_blocks_workflow_diagram" CASCADE;
  DROP TABLE "pages_blocks_platform_map" CASCADE;
  DROP TABLE "pages_blocks_logo_wall" CASCADE;
  DROP TABLE "pages_blocks_quote" CASCADE;
  DROP TABLE "pages_blocks_timeline" CASCADE;
  DROP TABLE "pages_blocks_audience_showcase" CASCADE;
  DROP TABLE "pages_blocks_split_cta" CASCADE;
  DROP TABLE "pages_blocks_contact_form" CASCADE;
  DROP TABLE "pages_blocks_newsletter" CASCADE;
  DROP TABLE "pages_blocks_faq" CASCADE;
  DROP TABLE "pages_blocks_card_feed" CASCADE;
  DROP TABLE "pages_blocks_article_body" CASCADE;
  DROP TABLE "pages_blocks_deck_embed" CASCADE;
  DROP TABLE "pages_blocks_episode_player" CASCADE;
  DROP TABLE "pages_blocks_gated_sign_in" CASCADE;
  DROP TABLE "pages_blocks_document_list" CASCADE;
  DROP TABLE "pages_blocks_legal_body" CASCADE;
  DROP TABLE "pages_blocks_error_page" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_texts" CASCADE;
  DROP TYPE "public"."enum_pages_template";
  DROP TYPE "public"."enum_pages_visibility";
  DROP TYPE "public"."enum_pages_gate";
  DROP TYPE "public"."enum_pages_status";`)
}
