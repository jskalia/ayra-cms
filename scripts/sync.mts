/**
 * The one-way sync, _ops → one site's tenant in Ayra CMS (WebsiteOps plan W5.4).
 * A person starts it (no schedule). The sync account's API key is read from SYNC_API_KEY,
 * never from the command line.
 *
 *   SYNC_API_KEY=… npm run sync -- --ops <path to _<org>_ops> --site <site> --tenant <tenant> \
 *     --cms https://cms.ayraagent.ai [--dry-run] [--schemas <folder with claims/atoms schemas>] [--actor <name>]
 *
 *   Verify the site still matches a receipt:   … --verify <receipt id | path to receipt .json>
 *   Roll back to an earlier _ops commit:       … --at <git commit>   (add --dry-run to preview)
 *
 * Exit codes: 0 done (or dry run planned, or verified), 1 refused, failed or mismatched, 2 usage.
 */
import os from 'node:os'
import path from 'node:path'

import { existsSync, readFileSync, rmSync } from 'node:fs'

import { RestClient } from '../src/sync/client'
import { runSync } from '../src/sync/run'
import { snapshotAt, verifyReceipt, type Receipt } from '../src/sync/verify'

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

const client = new RestClient(cms, apiKey)
const orgRoot = path.resolve(ops)

const verify = value('verify')
if (verify) {
  let receipt: Receipt | undefined
  if (existsSync(verify)) receipt = JSON.parse(readFileSync(verify, 'utf8'))
  else receipt = (await client.receipt(await client.tenantId(tenant), verify)) as Receipt | undefined
  if (!receipt) {
    console.error(`receipt not found: ${verify}`)
    process.exit(1)
  }
  const v = await verifyReceipt(client, tenant, receipt)
  console.log(`${v.ok ? 'MATCHES' : 'DIFFERS'}: receipt ${v.receiptId} — ${v.matched} match, ${v.changed.length} changed, ${v.missing.length} missing`)
  for (const c of v.changed) console.log(`  changed ${c.collection.padEnd(13)} ${c.recordId}`)
  for (const m of v.missing) console.log(`  missing ${m.collection.padEnd(13)} ${m.recordId}`)
  process.exit(v.ok ? 0 : 1)
}

const at = value('at')
const snapshot = at ? snapshotAt(orgRoot, at) : undefined
const result = await runSync({
  orgRoot: snapshot ?? orgRoot,
  receiptRoot: orgRoot,
  opsCommit: at,
  site,
  tenant,
  client,
  actor: value('actor') ?? os.userInfo().username,
  dryRun: flag('dry-run'),
  schemasDir: value('schemas'),
})

if (snapshot) rmSync(snapshot, { recursive: true, force: true })
if (result.problems.length) {
  console.error(`REFUSED: ${result.problems.length} problem(s); nothing was written.`)
  for (const p of result.problems) console.error(`  - ${p}`)
  process.exit(1)
}
const { create, update, unchanged, supersede } = result.counts
console.log(
  `${result.dryRun ? 'DRY RUN' : result.ok ? 'DONE' : 'FAILED'}: ${create} to create, ${update} to update, ${unchanged} unchanged` +
    (supersede ? `, ${supersede} legal version(s) to supersede.` : '.'),
)
for (const i of result.items.filter((x) => x.action !== 'unchanged')) console.log(`  ${i.action.padEnd(9)} ${i.collection.padEnd(13)} ${i.recordId}`)
if (result.orphans.length) {
  console.log(`In the site but no longer in _ops (left as they are): ${result.orphans.length}`)
  for (const o of result.orphans) console.log(`  orphan ${o.collection.padEnd(13)} ${o.recordId}`)
}
if (result.receiptId) console.log(`Receipt ${result.receiptId} (revision ${result.revision})${result.receiptPath ? ` → ${result.receiptPath}` : ''}`)
if (result.error) console.error(`Stopped at: ${result.error}`)
process.exit(result.ok ? 0 : 1)
