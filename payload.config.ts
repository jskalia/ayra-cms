import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import {
  lexicalEditor,
  FixedToolbarFeature,
  InlineToolbarFeature,
  UploadFeature,
  HeadingFeature,
  LinkFeature,
  BlockquoteFeature,
  HorizontalRuleFeature,
  OrderedListFeature,
  UnorderedListFeature,
  BoldFeature,
  ItalicFeature,
  ParagraphFeature,
} from '@payloadcms/richtext-lexical'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import sharp from 'sharp'

import { Users } from './src/collections/Users'
import { Posts } from './src/collections/Posts'
import { Categories } from './src/collections/Categories'
import { Authors } from './src/collections/Authors'
import { Media } from './src/collections/Media'
import { Tenants } from './src/collections/Tenants'
import { fieldHasRole } from './src/access/roles'
import type { User } from './payload-types'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)


/** Neon/Vercel: prefer direct (unpooled) URL for Payload; fall back through the template vars. */
function databaseConnectionString(): string {
  return (
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  )
}

/** No default secret: this repo is public, so a fallback value would let anyone forge login tokens. */
function requiredSecret(): string {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) {
    throw new Error('PAYLOAD_SECRET is not set. Set it in .env.local or Vercel (use 32+ random characters).')
  }
  return secret
}

export default buildConfig({
  serverURL: process.env.PAYLOAD_CMS_URL || 'http://localhost:3000',

  // CSRF origins: the CMS is reached directly and through the /admin rewrites on both sites.
  // Only the CMS's own origin may drive a signed-in admin session (the per-site /admin
  // proxies were dropped in the 2026-09-13 architecture review).
  csrf: [process.env.PAYLOAD_CMS_URL || 'http://localhost:3000', 'https://cms.ayraagent.ai'],

  // Not used; off so that adding a route file can never expose it.
  graphQL: { disable: true },

  routes: {
    admin: '/admin',
    api: '/cms-api',
  },

  admin: {
    user: 'users',
    meta: {
      titleSuffix: ' — AyraAgent CMS',
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },

  editor: lexicalEditor({
    features: () => [
      FixedToolbarFeature(),
      InlineToolbarFeature(),
      ParagraphFeature(),
      HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
      BoldFeature(),
      ItalicFeature(),
      LinkFeature({ enabledCollections: ['posts'] }),
      BlockquoteFeature(),
      OrderedListFeature(),
      UnorderedListFeature(),
      HorizontalRuleFeature(),
      UploadFeature({
        collections: {
          media: {
            fields: [
              {
                name: 'caption',
                type: 'text',
                label: 'Caption',
              },
              {
                name: 'alignment',
                type: 'select',
                label: 'Alignment',
                defaultValue: 'center',
                options: [
                  { label: 'Left', value: 'left' },
                  { label: 'Center', value: 'center' },
                  { label: 'Right', value: 'right' },
                  { label: 'Full width', value: 'full' },
                ],
              },
            ],
          },
        },
      }),
    ],
  }),

  db: postgresAdapter({
    pool: { connectionString: databaseConnectionString() },
    // Never push. Schema changes ship only as migrations in src/migrations (slai-web lesson:
    // a push once mutated production from a preview and caused a 2h outage; a pushed DB also
    // leaves a "dev" marker that makes later migrations silently skip). See scripts/migrate.mts.
    push: false,
  }),

  plugins: [
    // Always registered, with alwaysInsertFields, so the plugin's media columns exist in every
    // environment. Without it, migrations generated locally (no token) miss columns that
    // production (token set) queries, and /cms-api/media fails.
    vercelBlobStorage({
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      token: process.env.BLOB_READ_WRITE_TOKEN,
      alwaysInsertFields: true,
      collections: {
        media: true,
      },
    }),
    // One tenant per website (WebsiteOps plan W5.2). Signed-in users other than admins only
    // ever see the tenants listed on their account. Content collections also refuse anonymous
    // reads themselves (src/access/roles.ts), because the plugin does not scope anonymous requests.
    // The MCP plugin was removed (decision D9): content enters only through the _ops sync.
    multiTenantPlugin<{ user: User }>({
      tenantsSlug: 'tenants',
      collections: {
        posts: {},
        categories: {},
        authors: {},
        media: {},
      },
      userHasAccessToAllTenants: (user) => user?.role === 'admin',
      tenantsArrayField: {
        includeDefaultField: true,
        // Only an admin assigns tenants to an account.
        arrayFieldAccess: { create: fieldHasRole('admin'), update: fieldHasRole('admin') },
        tenantFieldAccess: { create: fieldHasRole('admin'), update: fieldHasRole('admin') },
      },
    }),
  ],

  collections: [Users, Tenants, Posts, Categories, Authors, Media],

  secret: requiredSecret(),

  sharp,

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  onInit: async (payload) => {
    // Local development only: seed an admin from env. Production admins are created by a person.
    if (process.env.NODE_ENV === 'production') return
    try {
      const email = process.env.PAYLOAD_ADMIN_EMAIL
      const password = process.env.PAYLOAD_ADMIN_PASSWORD

      if (!email || !password) {
        return
      }

      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'users',
          data: { email, password, name: 'Admin', role: 'admin' },
        })
        payload.logger.info(`Admin user created: ${email}`)
      }
    } catch (err: unknown) {
      payload.logger.warn(
        `onInit admin seed skipped: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  },
})
