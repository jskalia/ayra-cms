/**
 * The one-way sync, _ops → one site's tenant in Ayra CMS (WebsiteOps plan W5.4).
 * A person starts it (no schedule). The sync account's API key is read from SYNC_API_KEY,
 * never from the command line.
 *
 *   SYNC_API_KEY=… npm run sync -- --ops <path to _<org>_ops> --site <site> --tenant <tenant> \
 *     --cms https://cms.ayraagent.ai [--dry-run] [--schemas <folder with claims/atoms schemas>] [--actor <name>]
 *
 * Exit codes: 0 done (or dry run planned), 1 refused or failed, 2 usage.
 */
import os from 'node:os'
import path from 'node:path'

import { RestClient } from '../src/sync/client'
import { runSync } from '../src/sync/run'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const value = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const ops = value('ops')
const site = value('site')
const tenant = value('tenant') ?? site
const cms = value('cms')
const apiKey = process.env.SYNC_API_KEY
if (!ops || !site || !tenant || !cms || !apiKey) {
  console.error('usage: SYNC_API_KEY=… npm run sync -- --ops <_<org>_ops> --site <site> [--tenant <tenant>] --cms <url> [--dry-run] [--schemas <dir>] [--actor <name>]')
  process.exit(2)
}

const result = await runSync({
  orgRoot: path.resolve(ops),
  site,
  tenant,
  client: new RestClient(cms, apiKey),
  actor: value('actor') ?? os.userInfo().username,
  dryRun: flag('dry-run'),
  schemasDir: value('schemas'),
})

if (result.problems.length) {
  console.error(`REFUSED: ${result.problems.length} problem(s); nothing was written.`)
  for (const p of result.problems) console.error(`  - ${p}`)
  process.exit(1)
}
const { create, update, unchanged } = result.counts
console.log(`${result.dryRun ? 'DRY RUN' : result.ok ? 'DONE' : 'FAILED'}: ${create} to create, ${update} to update, ${unchanged} unchanged.`)
for (const i of result.items.filter((x) => x.action !== 'unchanged')) console.log(`  ${i.action.padEnd(6)} ${i.collection.padEnd(13)} ${i.recordId}`)
if (result.orphans.length) {
  console.log(`In the site but no longer in _ops (left as they are): ${result.orphans.length}`)
  for (const o of result.orphans) console.log(`  orphan ${o.collection.padEnd(13)} ${o.recordId}`)
}
if (result.receiptId) console.log(`Receipt ${result.receiptId} (revision ${result.revision})${result.receiptPath ? ` → ${result.receiptPath}` : ''}`)
if (result.error) console.error(`Stopped at: ${result.error}`)
process.exit(result.ok ? 0 : 1)
