/**
 * Import published AyraAgent blogs into the sites' posts (src/sync/blogs.ts), from a terminal.
 *
 *   npm run import:blogs -- [--site savelifeai] [--dry-run]
 *
 * Needs DATABASE_URL and PAYLOAD_SECRET for the CMS, AYRA_AGENT_API_BASE (default
 * https://api.ayraagent.ai) and each site's token env var (named in its ayraBlogs.tokenEnv).
 */
import { getPayload } from 'payload'

import config from '../payload.config'
import { runBlogImport } from '../src/sync/blogs'

const args = process.argv.slice(2)
const arg = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const payload = await getPayload({ config, disableOnInit: true })
const results = await runBlogImport({ payload, site: arg('--site'), dryRun: args.includes('--dry-run'), actor: process.env.USER ?? 'terminal' })
if (!results.length) console.log('No site has an AyraAgent org set (Tenants → AyraAgent Blogs → org).')
for (const r of results) {
  console.log(`${r.dryRun ? 'DRY RUN ' : ''}${r.site} ← AyraAgent org ${r.org}: ${r.ok ? 'ok' : 'PROBLEMS'}`, r.counts)
  for (const i of r.items.filter((x) => x.action !== 'unchanged')) console.log(`  ${i.action.padEnd(9)} ${i.recordId}`)
  for (const p of r.problems) console.log(`  ! ${p}`)
  if (r.receiptId) console.log(`  receipt ${r.receiptId}${r.deployHook ? ` · preview hook ${r.deployHook}` : ''}`)
}
process.exit(results.every((r) => r.ok) ? 0 : 1)
