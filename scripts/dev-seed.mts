/**
 * LOCAL ONLY: fill a local database with the sample org so the control room has something to
 * show. It creates a sync account for one tenant and runs the real sync (same rules as
 * production) from tests/fixtures. Refuses any database that is not on localhost.
 *
 *   DATABASE_URL=postgres://…@localhost:…/<db> npx tsx scripts/dev-seed.mts [tenant]
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const url = process.env.DATABASE_URL ?? ''
if (!/^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url) || process.env.VERCEL_ENV) {
  console.error('Refusing: dev-seed only runs against a localhost database, never on Vercel.')
  process.exit(2)
}
const tenantSlug = process.argv[2] ?? 'savelifeai'

const { getPayload } = await import('payload')
const { default: config } = await import('../payload.config')
const { LocalClient } = await import('../src/sync/client')
const { runSync } = await import('../src/sync/run')

const payload = await getPayload({ config })
const tenant = (await payload.find({ collection: 'tenants', where: { slug: { equals: tenantSlug } } })).docs[0]
if (!tenant) throw new Error(`no tenant ${tenantSlug}`)

const email = `sync-${tenantSlug}@example.test`
let sync = (await payload.find({ collection: 'users', where: { email: { equals: email } } })).docs[0]
if (!sync) {
  sync = await payload.create({
    collection: 'users',
    data: { email, name: `Sync ${tenantSlug}`, role: 'sync', password: `local-only-${Date.now()}`, tenants: [{ tenant: tenant.id }] } as never,
  })
}

const here = path.dirname(fileURLToPath(import.meta.url))
const result = await runSync({
  orgRoot: path.resolve(here, '../tests/fixtures/ops/_demo_ops'),
  site: 'demo',
  tenant: tenantSlug,
  client: new LocalClient(payload, { ...sync, collection: 'users' } as never),
  actor: 'dev-seed',
  receiptToOps: false,
})
console.log(result.ok ? `seeded ${tenantSlug}: ${JSON.stringify(result.counts)} (receipt ${result.receiptId})` : `failed: ${result.error ?? result.problems.join('; ')}`)
process.exit(result.ok ? 0 : 1)
