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
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import sharp from 'sharp'

import { Users } from './src/collections/Users'
import { Posts } from './src/collections/Posts'
import { Categories } from './src/collections/Categories'
import { Authors } from './src/collections/Authors'
import { Media } from './src/collections/Media'

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

export default buildConfig({
  serverURL: process.env.PAYLOAD_CMS_URL || 'http://localhost:3000',

  // CSRF origins: the CMS is reached directly and through the /admin rewrites on both sites.
  csrf: [
    process.env.PAYLOAD_CMS_URL || 'http://localhost:3000',
    'https://cms.ayraagent.ai',
    'https://ayraagent.ai',
    'https://heyayra.ai',
  ].filter(Boolean),

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
    // Schema push is OPT-IN ONLY (slai-web lesson: auto-push on deploy once mutated
    // production from a preview and caused a 2h outage). Deliberate flag only.
    push: process.env.PAYLOAD_PUSH_SCHEMA === '1',
  }),

  plugins: [
    ...(process.env.BLOB_READ_WRITE_TOKEN
      ? [
          vercelBlobStorage({
            enabled: true,
            token: process.env.BLOB_READ_WRITE_TOKEN,
            collections: {
              media: true,
            },
          }),
        ]
      : []),
    ...(process.env.PAYLOAD_MCP_ENABLED === '1'
      ? [
          mcpPlugin({
            collections: {
              posts: {
                description: 'Blog posts and articles',
                enabled: { find: true, create: true, update: true },
              },
              categories: {
                description: 'Post categories',
                enabled: { find: true, create: true, update: true },
              },
              authors: {
                description: 'Post authors',
                enabled: { find: true, create: true, update: true },
              },
              media: {
                description: 'Media library',
                enabled: { find: true, create: true },
              },
            },
          }),
        ]
      : []),
  ],

  collections: [Users, Posts, Categories, Authors, Media],

  secret: process.env.PAYLOAD_SECRET || 'dev-secret-ayra-cms-local-only',

  sharp,

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  onInit: async (payload) => {
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
