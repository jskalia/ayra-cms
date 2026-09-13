/**
 * Build-time schema bootstrap (slai-web pattern, non-destructive variant).
 *
 * Payload's automatic schema push does not execute in production builds, so the
 * tables are created directly via SQL from the collection definitions. This
 * script runs before `next build` on Vercel, where the Neon env vars live.
 *
 * It is CREATE-ONLY (idempotent, `IF NOT EXISTS` everywhere) — it never drops
 * or alters anything, so it cannot destroy data. It is still strictly opt-in:
 * PAYLOAD_PUSH_SCHEMA=1 plus a database env are both required, otherwise it
 * self-skips (local builds and ordinary deploys never touch the schema — the
 * slai-web outage lesson). Long-term: move to real Payload migrations once the
 * content model stabilizes.
 */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pg = require('pg') as typeof import('pg')

async function main(): Promise<void> {
  const flagged = process.env.PAYLOAD_PUSH_SCHEMA === '1'
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''

  if (!flagged || !connectionString) {
    console.log('[push-schema] skipped (no PAYLOAD_PUSH_SCHEMA=1 or no database env)')
    return
  }

  const client = new pg.Client({ connectionString })
  await client.connect()
  const host = new URL(connectionString).hostname
  console.log(`[push-schema] connected to ${host}; creating schema (idempotent)…`)

  const sql = `
DO $$ BEGIN
  CREATE TYPE "enum_users_role" AS ENUM ('admin', 'editor');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Users (auth collection)
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "name" varchar,
  "role" "enum_users_role" DEFAULT 'editor',
  "email" varchar NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "reset_password_token" varchar,
  "reset_password_expiration" timestamp(3) with time zone,
  "salt" varchar,
  "hash" varchar,
  "login_attempts" numeric DEFAULT 0,
  "lock_until" timestamp(3) with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("created_at");

CREATE TABLE IF NOT EXISTS "users_sessions" (
  "id" varchar PRIMARY KEY,
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp(3) with time zone,
  "token" varchar
);
CREATE INDEX IF NOT EXISTS "users_sessions_order_idx" ON "users_sessions" ("_order");
CREATE INDEX IF NOT EXISTS "users_sessions_parent_id_idx" ON "users_sessions" ("_parent_id");

-- Media (upload; sizes thumbnail/card/og)
CREATE TABLE IF NOT EXISTS "media" (
  "id" serial PRIMARY KEY,
  "alt" varchar,
  "prefix" varchar DEFAULT 'media',
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "url" varchar,
  "thumbnail_u_r_l" varchar,
  "card_u_r_l" varchar,
  "og_u_r_l" varchar,
  "filename" varchar,
  "mime_type" varchar,
  "filesize" numeric,
  "width" numeric,
  "height" numeric,
  "focal_x" numeric,
  "focal_y" numeric
);
CREATE INDEX IF NOT EXISTS "media_created_at_idx" ON "media" ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "media_filename_idx" ON "media" ("filename");

-- Categories
CREATE TABLE IF NOT EXISTS "categories" (
  "id" serial PRIMARY KEY,
  "title" varchar NOT NULL,
  "slug" varchar,
  "description" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");
CREATE INDEX IF NOT EXISTS "categories_created_at_idx" ON "categories" ("created_at");

-- Authors
CREATE TABLE IF NOT EXISTS "authors" (
  "id" serial PRIMARY KEY,
  "name" varchar NOT NULL,
  "title" varchar,
  "bio" varchar,
  "photo_id" integer REFERENCES "media"("id") ON DELETE SET NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "authors_created_at_idx" ON "authors" ("created_at");

-- Posts (drafts enabled → _status + versions table)
CREATE TABLE IF NOT EXISTS "posts" (
  "id" serial PRIMARY KEY,
  "title" varchar NOT NULL,
  "slug" varchar,
  "excerpt" varchar,
  "content" jsonb,
  "meta_description" varchar,
  "published_at" timestamp(3) with time zone,
  "featured_image_id" integer REFERENCES "media"("id") ON DELETE SET NULL,
  "_status" varchar DEFAULT 'draft',
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" ("slug");
CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" ("created_at");

CREATE TABLE IF NOT EXISTS "posts_rels" (
  "id" serial PRIMARY KEY,
  "order" integer,
  "parent_id" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "path" varchar NOT NULL,
  "categories_id" integer REFERENCES "categories"("id") ON DELETE CASCADE,
  "authors_id" integer REFERENCES "authors"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "posts_rels_order_idx" ON "posts_rels" ("order");
CREATE INDEX IF NOT EXISTS "posts_rels_parent_idx" ON "posts_rels" ("parent_id");
CREATE INDEX IF NOT EXISTS "posts_rels_path_idx" ON "posts_rels" ("path");

CREATE TABLE IF NOT EXISTS "posts_versions" (
  "id" serial PRIMARY KEY,
  "parent_id" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "version" jsonb NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "posts_versions_parent_id_idx" ON "posts_versions" ("parent_id");

-- Payload internal tables
CREATE TABLE IF NOT EXISTS "payload_preferences" (
  "id" serial PRIMARY KEY,
  "key" varchar,
  "value" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "payload_preferences_key_idx" ON "payload_preferences" ("key");
CREATE INDEX IF NOT EXISTS "payload_preferences_created_at_idx" ON "payload_preferences" ("created_at");

CREATE TABLE IF NOT EXISTS "payload_migrations" (
  "id" serial PRIMARY KEY,
  "name" varchar,
  "batch" numeric,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "payload_migrations_created_at_idx" ON "payload_migrations" ("created_at");
`

  await client.query(sql)

  const { rows: tables } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  )
  console.log(`[push-schema] complete — tables (${tables.length}): ${tables.map((r: { tablename: string }) => r.tablename).join(', ')}`)
  await client.end()
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[push-schema] FAILED:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
