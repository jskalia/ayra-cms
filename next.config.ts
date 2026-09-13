import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withPayload } = require('@payloadcms/next/withPayload')

const nextConfigDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // Avoid wrong workspace root when a parent folder has another lockfile.
  turbopack: {
    root: nextConfigDir,
  },
}

export default withPayload(nextConfig)
