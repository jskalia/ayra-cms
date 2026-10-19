/**
 * Phase 4a: pre-flight check of a whole _ops snapshot, before the sync writes anything.
 * It applies the CMS's rules to the snapshot itself, so a run does not stop half way:
 * id formats, duplicates, approvals, the vocabulary gate, and the citation rule (an approved
 * public record cites only public, active, approved, released records of the same snapshot).
 * Optionally it validates claims.json and atoms.json against Sir's JSON Schemas.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { RECORD_ID_PATTERNS } from '../fields/record'
import { collectRefs } from '../hooks/pageReferences'
import type { SyncRecord } from './read'

const BANNED = [/Ayra\s+Platform/i, /Super\s*App/i]

type R = SyncRecord & { data: Record<string, unknown> }

const isPublicRecord: Record<string, (d: Record<string, unknown>) => boolean> = {
  claims: (d) => d.visibility === 'public' && d.status === 'active',
  atoms: (d) => d.visibility === 'public' && d.status === 'active',
  media: (d) => d.status === 'approved',
  products: (d) => d.released === true,
}
const kindToCollection: Record<string, string> = { claim: 'claims', atom: 'atoms', asset: 'media', product: 'products' }

/** Which records are "live" and which values may hold citations, per collection. */
const citing: Record<string, { live: (d: Record<string, unknown>) => boolean; isPublic: (d: Record<string, unknown>) => boolean; values: (d: Record<string, unknown>) => unknown[] }> = {
  pages: { live: (d) => d.status === 'approved', isPublic: (d) => d.visibility === 'public', values: (d) => [d.product, d.blocks, d.seo, d.bodyMarkdown] },
  posts: { live: (d) => d.status === 'approved', isPublic: (d) => d.visibility === 'public', values: (d) => [d.heroAsset, d.cites, d.seo, d.bodyMarkdown] },
  'whats-new': { live: (d) => d.status === 'approved' || d.status === 'published', isPublic: (d) => d.visibility === 'public', values: (d) => [d.product, d.whatShipped, d.regulated, d.assets] },
  atoms: { live: (d) => d.status === 'active', isPublic: (d) => d.visibility === 'public', values: (d) => [d.claims, d.assets, d.shape] },
}

export function checkSnapshot(records: SyncRecord[]): string[] {
  const problems: string[] = []
  const at = (r: SyncRecord) => `${r.sourcePath} ${r.recordId}`
  const byId = new Map<string, R>()

  for (const r of records as R[]) {
    // id format
    const prefix = Object.keys(RECORD_ID_PATTERNS).find((p) => r.recordId.startsWith(p))
    if (!prefix || !RECORD_ID_PATTERNS[prefix].test(r.recordId)) problems.push(`${at(r)}: not a valid record id`)
    // duplicates
    const key = `${r.collection}|${r.recordId}`
    if (byId.has(key)) problems.push(`${at(r)}: duplicate record id (also in ${byId.get(key)!.sourcePath})`)
    byId.set(key, r)
    // approvals
    const d = r.data
    if ((r.collection === 'pages' || r.collection === 'posts') && d.status === 'approved') {
      const a = (d.approved ?? {}) as Record<string, unknown>
      if (!a.by || !a.at) problems.push(`${at(r)}: approved but no approved.by / approved.at`)
    }
    if (r.collection === 'posts' && d.status === 'approved' && !((d.author ?? {}) as Record<string, unknown>).name) {
      problems.push(`${at(r)}: an approved post names a real author`)
    }
    // vocabulary
    const text = JSON.stringify(d)
    for (const b of BANNED) if (b.test(text)) problems.push(`${at(r)}: banned vocabulary (${text.match(b)![0]})`)
  }

  // Citations, resolved within the snapshot
  const lookup = (ref: string) => {
    const kind = ref.split(':')[0]
    const collection = kindToCollection[kind]
    return collection ? byId.get(`${collection}|${ref}`) : undefined
  }
  for (const r of records as R[]) {
    const rule = citing[r.collection]
    if (!rule || !rule.live(r.data)) continue
    const pub = rule.isPublic(r.data)
    for (const ref of collectRefs(rule.values(r.data))) {
      const kind = ref.split(':')[0]
      const target = lookup(ref)
      if (!kindToCollection[kind]) problems.push(`${at(r)}: cites ${ref} (unknown prefix; ids are lowercase)`)
      else if (!target) problems.push(`${at(r)}: cites ${ref}, which is not in this snapshot`)
      else if (pub && !isPublicRecord[target.collection](target.data)) {
        problems.push(`${at(r)}: public record cites ${ref}, which is not public (internal, investor-only, retired, unapproved or unreleased)`)
      }
    }
  }
  return problems
}

/**
 * Validates every claims.json and atoms.json in the snapshot against Sir's JSON Schemas
 * (templates/claims.schema.json: #/$defs/promotedFile for records/; templates/atoms.schema.json).
 * The schemas are read from a folder given at run time; they are not copied into this repo.
 */
export async function checkSchemas(orgRoot: string, records: SyncRecord[], schemasDir: string): Promise<string[]> {
  const { default: Ajv2020 } = await import('ajv/dist/2020.js')
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const claimsSchema = JSON.parse(readFileSync(path.join(schemasDir, 'claims.schema.json'), 'utf8'))
  const atomsSchema = JSON.parse(readFileSync(path.join(schemasDir, 'atoms.schema.json'), 'utf8'))
  ajv.addSchema(claimsSchema, 'claims')
  ajv.addSchema(atomsSchema, 'atoms')
  const validators: Record<string, ReturnType<typeof ajv.getSchema>> = {
    'claims.json': ajv.getSchema('claims#/$defs/promotedFile') ?? ajv.getSchema('claims'),
    'atoms.json': ajv.getSchema('atoms'),
  }
  const problems: string[] = []
  const seen = new Set<string>()
  for (const r of records) {
    const base = path.basename(r.sourcePath)
    const validate = validators[base]
    if (!validate || seen.has(r.sourcePath)) continue
    seen.add(r.sourcePath)
    const doc = JSON.parse(readFileSync(path.join(orgRoot, r.sourcePath), 'utf8'))
    if (!validate(doc)) {
      for (const e of validate.errors ?? []) problems.push(`${r.sourcePath}: ${e.instancePath || '/'} ${e.message}`)
    }
  }
  return problems
}
