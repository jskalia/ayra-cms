/**
 * Import published AyraAgent blogs into the sites' posts (src/sync/blogs.ts), from a terminal.
 *
 *   npm run import:blogs -- --site junaidkalia [--dry-run] [--from-file blog.json] [--cms https://cms.ayraagent.ai]
 *
 *  --cms        write over HTTPS as the site's sync account (key in SYNC_API_KEY); no database
 *               access needed. Without it, connects to the CMS database (DATABASE_URL, PAYLOAD_SECRET).
 *  --from-file  a JSON file with one blog or a list, in AyraAgent's blog shape, instead of the
 *               AyraAgent API (for imports before a service token exists). Never retires other posts.
 * Otherwise blogs come from AYRA_AGENT_API_BASE (default https://api.ayraagent.ai) with each
 * site's token env var (named in its ayraBlogs.tokenEnv).
 */
import { readFileSync } from 'node:fs'

import { fileSource, restStore, runBlogImport, type AyraBlog, type ImportOptions } from '../src/sync/blogs'

const args = process.argv.slice(2)
const arg = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const opts: ImportOptions = { site: arg('--site'), dryRun: args.includes('--dry-run'), actor: process.env.USER ?? 'terminal' }

const file = arg('--from-file')
if (file) {
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as AyraBlog | AyraBlog[]
  opts.source = fileSource(Array.isArray(parsed) ? parsed : [parsed])
  opts.actor = `${opts.actor} (file ${file.split('/').pop()})`
}
const cms = arg('--cms')
if (cms) {
  const apiKey = process.env.SYNC_API_KEY
  if (!apiKey) {
    console.error('Set SYNC_API_KEY to the site’s sync-account API key (never pass it on the command line).')
    process.exit(2)
  }
  if (!/^https:\/\//.test(cms) && !/^http:\/\/localhost(:\d+)?$/.test(cms)) {
    console.error('--cms must be https (the key is sent with every request).')
    process.exit(2)
  }
  opts.store = restStore({ base: cms, apiKey })
} else {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')
  opts.payload = await getPayload({ config, disableOnInit: true })
}

const results = await runBlogImport(opts)
if (!results.length) console.log('No site found with an AyraAgent org set (Tenants → AyraAgent Blogs → org), or the key cannot see it.')
for (const r of results) {
  console.log(`${r.dryRun ? 'DRY RUN ' : ''}${r.site} ← org ${r.org}: ${r.ok ? 'ok' : 'PROBLEMS'}`, r.counts)
  for (const i of r.items.filter((x) => x.action !== 'unchanged')) console.log(`  ${i.action.padEnd(9)} ${i.recordId}`)
  for (const p of r.problems) console.log(`  ! ${p}`)
  if (r.receiptId) console.log(`  receipt ${r.receiptId}${r.deployHook ? ` · preview hook ${r.deployHook}` : ''}`)
}
process.exit(results.length && results.every((r) => r.ok) ? 0 : 1)
