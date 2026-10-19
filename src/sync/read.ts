/**
 * Phase 4a: read one org's _ops records and map them to CMS documents (WebsiteOps plan W5.4,
 * S-1: _ops is the one source of truth; the CMS mirrors it one way).
 *
 *   <orgRoot>/marketing/records/
 *     channels/web/<site>/site.yaml              → site-settings
 *     channels/web/<site>/pages/*.md             → pages
 *     channels/web/<site>/pages/blog/*.md        → posts
 *     products/<p>/product.md                    → products     (front matter format ASSUMED)
 *     products/<p>/claims.json                   → claims
 *     products/<p>/atoms.json                    → atoms
 *     products/<p>/assets.index.json + files     → media        (index format ASSUMED)
 *     releases/<yyyy>-<slug>/release.md          → whats-new    (only releases listing this site)
 *
 * Reading never writes anything. Every record carries its source path and a sha256 of its
 * canonical content, so the writer can skip unchanged records and a receipt can be verified.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

export type SyncCollection = 'site-settings' | 'products' | 'claims' | 'atoms' | 'media' | 'pages' | 'posts' | 'whats-new'

/** The order records are written in, so every citation already exists when it is checked. */
export const WRITE_ORDER: SyncCollection[] = ['site-settings', 'products', 'media', 'claims', 'atoms', 'pages', 'posts', 'whats-new']

export type SyncRecord = {
  collection: SyncCollection
  recordId: string
  /** Path of the source file, relative to the org root. */
  sourcePath: string
  /** sha256 of the canonical record (what the writer compares to skip unchanged records). */
  sha256: string
  data: Record<string, unknown>
  /** For media: the file to upload. */
  file?: { absolutePath: string; name: string; mimetype: string }
}

export type ReadResult = { records: SyncRecord[]; problems: string[] }

/** JSON with sorted keys, so the same record always hashes the same. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}
export const sha256 = (input: string | Buffer) => createHash('sha256').update(input).digest('hex')

/** Splits "---\n<yaml>\n---\n<body>" into front matter and Markdown body. */
export function frontMatter(text: string): { meta: Record<string, unknown>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) throw new Error('missing --- front matter ---')
  return { meta: (parseYaml(m[1]) as Record<string, unknown>) ?? {}, body: m[2].trim() }
}

const without = (o: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)))
const ref = (prefix: string, id: unknown) => (typeof id === 'string' && !id.startsWith(prefix) ? `${prefix}${id}` : id)
const files = (dir: string, ext: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext) && statSync(path.join(dir, f)).isFile()).sort() : []
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif' }

// ---------------------------------------------------------------------------------------------
// Mappers: _ops record → CMS document fields (the CMS field names, camelCase).

export const mapSite = (y: Record<string, unknown>) => {
  const domains = (y.domains ?? {}) as Record<string, unknown>
  const kit = (y.kit ?? {}) as Record<string, unknown>
  const consent = (y.consent ?? {}) as Record<string, unknown>
  return {
    recordId: `site:${y.site}`,
    org: y.org,
    brand: y.brand,
    status: y.status,
    look: y.look,
    domains: {
      primary: domains.primary,
      www: domains.www,
      redirects: ((domains.redirect ?? []) as Record<string, unknown>[]).map((r) => ({
        domain: r.domain, rule: r.rule, target: r.target, keepServed: r.keep_served,
      })),
    },
    releaseSources: y.release_sources,
    kit: { path: kit.path, section: kit.section, systemId: kit.system_id, version: kit.version === undefined ? undefined : String(kit.version), approved: kit.approved },
    nav: y.nav,
    navCta: y.nav_cta,
    footer: y.footer,
    legalSet: ((y.legal_set ?? []) as Record<string, unknown>[]).map((l) => ({
      type: l.type, page: l.page, version: l.version === undefined ? undefined : String(l.version), counsel: l.counsel, generatedFrom: l.generated_from,
    })),
    forms: ((y.forms ?? []) as Record<string, unknown>[]).map((f) => ({
      formId: f.id, purpose: f.purpose, inbox: f.inbox, inboxOwner: f.inbox_owner, slaHours: f.sla_hours,
      confirmationEmail: f.confirmation_email, sendAdapter: f.send_adapter, spam: f.spam,
      noticeAtCollection: f.notice_at_collection, asksHealthInformation: f.asks_health_information,
    })),
    channels: ((y.channels ?? []) as Record<string, unknown>[]).map((c) => ({ channelId: c.id, url: c.url, owner: c.owner })),
    consent: { register: consent.register, notice: consent.notice, defaults: consent.defaults, policyVersion: consent.policy_version === undefined ? undefined : String(consent.policy_version) },
    ui: y.ui,
    modules: y.modules,
    retiring: y.retiring,
    owners: y.owners,
    approvers: y.approvers,
    redesign: y.redesign,
  }
}

export const mapProduct = (m: Record<string, unknown>) => ({
  recordId: ref('product:', m.id),
  name: m.name,
  released: m.released === true,
  status: m.status === undefined ? undefined : String(m.status),
  record: without(m, ['id', 'name', 'released', 'status']),
})

export const mapClaim = (c: Record<string, unknown>, entity: unknown) => {
  const source = (c.source ?? {}) as Record<string, unknown>
  const fda = c.fda_view as Record<string, unknown> | undefined
  return {
    recordId: ref('claim:', c.id),
    entity,
    text: c.text,
    source: { path: source.path, lineOrSection: source.line_or_section, pinnedDate: source.pinned_date, commit: source.commit },
    sha256: c.sha256 ?? c.sha256_of_source_file,
    quote: c.quote,
    visibility: c.visibility,
    visibilityNote: c.visibility_note,
    status: c.status,
    regulated: c.regulated,
    kNumber: c.k_number,
    platformVsModule: c.platform_vs_module,
    product: c.product,
    fdaView: fda ? { signedBy: fda.signed_by, signedAt: fda.signed_at } : undefined,
    approvedBy: c.approved_by,
    approvedAt: c.approved_at,
    supersededBy: c.superseded_by,
    note: c.note,
  }
}

export const mapAtom = (a: Record<string, unknown>) => ({
  recordId: ref('atom:', a.id),
  version: a.version,
  kind: a.kind,
  recipe: a.recipe,
  title: a.title,
  claims: ((a.claims ?? []) as unknown[]).map((c) => ref('claim:', c)),
  assets: a.assets,
  visibility: a.visibility,
  visibilityNote: a.visibility_note,
  status: a.status ?? 'active',
  shape: without(a, ['id', 'version', 'kind', 'recipe', 'title', 'claims', 'assets', 'visibility', 'visibility_note', 'status']),
})

export const mapAsset = (a: Record<string, unknown>) => ({
  recordId: a.id,
  kind: a.kind,
  status: a.status,
  sha256: a.sha256,
  licence: a.licence,
  attribution: a.attribution,
  consent: a.consent,
  alt: a.alt,
})

const seo = (s: Record<string, unknown> = {}) => ({
  title: s.title, description: s.description, canonical: s.canonical, og: s.og,
  jsonld: s.jsonld, sitemap: s.sitemap, llmsTxt: s.llms_txt, noindex: s.noindex,
})
const approval = (a: Record<string, unknown> = {}) => ({
  by: a.by ?? undefined, at: a.at === undefined || a.at === null ? undefined : String(a.at), version: a.version === undefined || a.version === null ? undefined : String(a.version),
})

export const mapPage = (m: Record<string, unknown>, body: string) => ({
  recordId: m.id,
  template: m.template,
  route: m.route,
  product: m.product,
  blocks: ((m.blocks ?? []) as Record<string, unknown>[]).map((b) => ({ blockType: b.id, props: b.props ?? {} })),
  seo: seo(m.seo as Record<string, unknown>),
  visibility: m.visibility,
  gate: m.gate,
  owner: m.owner,
  reviewBy: m.review_by === undefined ? undefined : String(m.review_by),
  status: m.status,
  approved: approval(m.approved as Record<string, unknown>),
  bodyMarkdown: body || undefined,
})

export const mapPost = (m: Record<string, unknown>, body: string, slug: string) => {
  const author = (m.author ?? {}) as Record<string, unknown>
  const s = seo(m.seo as Record<string, unknown>)
  return {
    recordId: `post:${slug}`,
    slug,
    title: m.title ?? s.title,
    excerpt: m.excerpt ?? s.description,
    author: { name: author.name, jobTitle: author.job_title, url: author.url, sameAs: author.same_as },
    tags: m.tags,
    publishedAt: m.published_at === undefined ? undefined : String(m.published_at),
    heroAsset: m.hero_asset,
    cites: m.cites,
    seo: { title: s.title, description: s.description, canonical: s.canonical, og: s.og, noindex: s.noindex },
    visibility: m.visibility,
    status: m.status,
    approved: approval(m.approved as Record<string, unknown>),
    owner: m.owner,
    reviewBy: m.review_by === undefined ? undefined : String(m.review_by),
    bodyMarkdown: body || undefined,
  }
}

export const mapRelease = (m: Record<string, unknown>, body: string) => {
  const appr = (m.approvals ?? {}) as Record<string, Record<string, unknown>>
  const source = (m.source ?? {}) as Record<string, unknown>
  const summary = body.replace(/^##\s*Summary[^\n]*\n/i, '').split(/\n##\s/)[0].trim()
  return {
    recordId: m.id,
    kind: m.kind,
    product: m.product,
    version: m.version === undefined ? undefined : String(m.version),
    releasedAt: m.released_at === undefined ? undefined : String(m.released_at),
    summary: summary || undefined,
    tier: m.tier ?? undefined,
    audiences: m.audiences,
    whatShipped: m.what_shipped,
    regulated: ((m.regulated ?? []) as Record<string, unknown>[]).map((r) => {
      const fda = (r.fda_view ?? {}) as Record<string, unknown>
      return { claim: r.claim, kNumber: r.k_number, platformVsModule: r.platform_vs_module, fdaSignedBy: fda.signed_by, fdaSignedAt: fda.signed_at }
    }),
    visibility: m.visibility,
    canonicalUrl: m.canonical_url,
    entry: m.entry,
    assets: m.assets,
    status: m.status,
    features: ((m.features ?? []) as Record<string, unknown>[]).map((f) => ({ name: f.name, state: f.state, claim: f.claim })),
    source: { type: source.type, ref: source.ref, sha256: source.sha256 ?? undefined },
    withheld: m.withheld,
    channels: m.channels,
    approvals: { facts: approval(appr.facts), entry: approval(appr.entry), production: approval(appr.production) },
    receipts: m.receipts,
    siteRelease: m.site_release,
  }
}

// ---------------------------------------------------------------------------------------------

/** Removes undefined values (deeply) so the hash and the CMS payload are the same shape. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)]),
    ) as T
  }
  return value
}

export function readOps(orgRoot: string, site: string): ReadResult {
  const records: SyncRecord[] = []
  const problems: string[] = []
  const root = path.join(orgRoot, 'marketing', 'records')
  const rel = (p: string) => path.relative(orgRoot, p)
  const add = (collection: SyncCollection, absPath: string, data: Record<string, unknown>, file?: SyncRecord['file'], extraHash = '') => {
    const cleaned = clean(data)
    records.push({
      collection,
      recordId: String(cleaned.recordId),
      sourcePath: rel(absPath),
      sha256: sha256(canonical(cleaned) + extraHash),
      data: cleaned,
      file,
    })
  }
  const attempt = (absPath: string, fn: () => void) => {
    try {
      fn()
    } catch (err) {
      problems.push(`${rel(absPath)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (!existsSync(root)) return { records, problems: [`no records folder at ${root}`] }

  // Site
  const webDir = path.join(root, 'channels', 'web', site)
  const siteYaml = path.join(webDir, 'site.yaml')
  if (existsSync(siteYaml)) attempt(siteYaml, () => add('site-settings', siteYaml, mapSite(parseYaml(readFileSync(siteYaml, 'utf8')))))
  else problems.push(`${rel(siteYaml)}: missing (every site has a site.yaml)`)

  // Products: product.md, claims.json, atoms.json, assets.index.json
  const productsDir = path.join(root, 'products')
  for (const p of existsSync(productsDir) ? readdirSync(productsDir).sort() : []) {
    const dir = path.join(productsDir, p)
    if (!statSync(dir).isDirectory()) continue
    const productMd = path.join(dir, 'product.md')
    if (existsSync(productMd)) attempt(productMd, () => add('products', productMd, mapProduct(frontMatter(readFileSync(productMd, 'utf8')).meta)))
    const claimsJson = path.join(dir, 'claims.json')
    if (existsSync(claimsJson)) {
      attempt(claimsJson, () => {
        const file = JSON.parse(readFileSync(claimsJson, 'utf8'))
        for (const c of file.claims ?? []) add('claims', claimsJson, mapClaim(c, file.entity))
      })
    }
    const atomsJson = path.join(dir, 'atoms.json')
    if (existsSync(atomsJson)) {
      attempt(atomsJson, () => {
        for (const a of JSON.parse(readFileSync(atomsJson, 'utf8')).atoms ?? []) add('atoms', atomsJson, mapAtom(a))
      })
    }
    const assetsJson = path.join(dir, 'assets.index.json')
    if (existsSync(assetsJson)) {
      attempt(assetsJson, () => {
        for (const a of JSON.parse(readFileSync(assetsJson, 'utf8')).assets ?? []) {
          const absolutePath = path.resolve(dir, String(a.file))
          if (!absolutePath.startsWith(dir + path.sep)) throw new Error(`${a.id}: file must stay inside the product folder`)
          if (!existsSync(absolutePath)) throw new Error(`${a.id}: file not found: ${a.file}`)
          const bytes = readFileSync(absolutePath)
          const actual = sha256(bytes)
          if (a.sha256 && a.sha256 !== actual) throw new Error(`${a.id}: file sha256 does not match the index`)
          const mimetype = MIME[path.extname(absolutePath).toLowerCase()]
          if (!mimetype) throw new Error(`${a.id}: not an image file (${path.extname(absolutePath)})`)
          add('media', assetsJson, mapAsset({ ...a, sha256: actual }), { absolutePath, name: path.basename(absolutePath), mimetype }, actual)
        }
      })
    }
  }

  // Pages and blog posts
  const pagesDir = path.join(webDir, 'pages')
  for (const f of files(pagesDir, '.md')) {
    const p = path.join(pagesDir, f)
    attempt(p, () => {
      const { meta, body } = frontMatter(readFileSync(p, 'utf8'))
      add('pages', p, mapPage(meta, body))
    })
  }
  const blogDir = path.join(pagesDir, 'blog')
  for (const f of files(blogDir, '.md')) {
    const p = path.join(blogDir, f)
    attempt(p, () => {
      const { meta, body } = frontMatter(readFileSync(p, 'utf8'))
      add('posts', p, mapPost(meta, body, f.replace(/\.md$/, '')))
    })
  }

  // Releases that list this site
  const releasesDir = path.join(root, 'releases')
  for (const r of existsSync(releasesDir) ? readdirSync(releasesDir).sort() : []) {
    const p = path.join(releasesDir, r, 'release.md')
    if (!existsSync(p)) continue
    attempt(p, () => {
      const { meta, body } = frontMatter(readFileSync(p, 'utf8'))
      if (!((meta.sites as unknown[]) ?? []).includes(site)) return
      add('whats-new', p, mapRelease(meta, body))
    })
  }

  return { records, problems }
}

