import config from '@payload-config'
import { getPayload } from 'payload'

import { runBlogImport } from '../../../sync/blogs'

/**
 * Imports published AyraAgent blogs into every site that has an AyraAgent org (src/sync/blogs.ts).
 * Called by a scheduler (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`); refused
 * without that secret, and refused entirely while CRON_SECRET is unset.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const payload = await getPayload({ config })
  const results = await runBlogImport({ payload, actor: 'ayra-blogs importer (scheduled)' })
  return Response.json({
    ok: results.every((r) => r.ok),
    sites: results.map(({ site, org, ok, counts, problems, receiptId, deployHook }) => ({ site, org, ok, counts, problems, receiptId, deployHook })),
  })
}
