import { ValidationError, type CollectionBeforeValidateHook, type CollectionSlug, type Where } from 'payload'

import { PUBLIC_ACTIVE } from '../access/roles'
import { richTextRefs } from './sameTenantReferences'

/**
 * An approved page may only cite records that exist in its own site, and an approved PUBLIC
 * page only records a website may show (templates/page.md lint: "atom:… is visibility:
 * internal today, so it cannot fill the FAQ slot"; G-SITE-7; MP-D29). Checked when the sync
 * writes the page, so a public page can never point at an internal, investor-only, retired,
 * unapproved or unreleased record. Wording lints stay with the claims lint (G-SITE-8).
 */
const KINDS: Record<string, { collection: CollectionSlug; publicOnly: Where }> = {
  claim: { collection: 'claims', publicOnly: PUBLIC_ACTIVE },
  atom: { collection: 'atoms', publicOnly: PUBLIC_ACTIVE },
  asset: { collection: 'media', publicOnly: { status: { equals: 'approved' } } },
  product: { collection: 'products', publicOnly: { released: { equals: true } } },
  deck: { collection: 'decks', publicOnly: { and: [{ status: { equals: 'approved' } }, { gate: { equals: 'none' } }] } },
  legal: { collection: 'legal', publicOnly: { status: { in: ['published', 'superseded'] } } },
  // Trust documents are gated: never resolvable from a public, ungated page.
  trustdoc: { collection: 'trust-documents', publicOnly: { id: { exists: false } } },
  audience: { collection: 'audiences', publicOnly: PUBLIC_ACTIVE },
  workflow: { collection: 'workflows', publicOnly: PUBLIC_ACTIVE },
}
// Anywhere in a string (prose included) or an object key; trailing punctuation is not part of the id.
const REF = /\b(claim|atom|asset|product|deck|legal|trustdoc|audience|workflow):[^\s"'<>,;()\[\]{}]+/gi
const trim = (ref: string) => ref.replace(/[.,;:!?]+$/, '')

/** Every claim:/atom:/asset:/product: reference anywhere inside a value (strings and keys). */
export function collectRefs(value: unknown, found = new Set<string>()): Set<string> {
  const scan = (text: string) => {
    for (const m of text.matchAll(REF)) found.add(trim(m[0]))
  }
  if (typeof value === 'string') {
    scan(value)
  } else if (Array.isArray(value)) {
    for (const v of value) collectRefs(v, found)
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      scan(k)
      collectRefs(v, found)
    }
  }
  return found
}

type Doc = Record<string, unknown>

/**
 * Builds the check for one collection: `collect` returns the values that may hold references,
 * `approved` and `public` say when the record is live and when it is public.
 */
export const publicReferences =
  (opts: {
    collect: (doc: Doc) => unknown[]
    approved: (doc: Doc) => boolean
    isPublic: (doc: Doc) => boolean
    uploads?: (doc: Doc) => { collection: string; id: number | string }[]
  }): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req, collection }) => {
    const doc = { ...originalDoc, ...data } as Doc
    if (!opts.approved(doc)) return data
    const tenant = typeof doc.tenant === 'object' && doc.tenant ? (doc.tenant as { id: unknown }).id : doc.tenant
    if (tenant === undefined || tenant === null) {
      throw new ValidationError({ collection: collection.slug, errors: [{ path: 'tenant', message: 'A tenant is required.' }] })
    }
    const isPublic = opts.isPublic(doc)

    const byKind = new Map<string, string[]>()
    const problems: string[] = []
    for (const ref of collectRefs(opts.collect(doc))) {
      const kind = ref.split(':')[0]
      if (!KINDS[kind]) {
        problems.push(ref) // e.g. an upper-case prefix: never resolvable
        continue
      }
      byKind.set(kind, [...(byKind.get(kind) ?? []), ref])
    }

    for (const [kind, ids] of byKind) {
      const { collection: slug, publicOnly } = KINDS[kind]
      const where: Where[] = [{ recordId: { in: ids } }, { tenant: { equals: tenant } }]
      if (isPublic) where.push(publicOnly)
      const { docs } = await req.payload.find({
        collection: slug,
        overrideAccess: true,
        req,
        depth: 0,
        limit: ids.length,
        pagination: false,
        where: { and: where },
      })
      const ok = new Set(docs.map((d) => (d as { recordId?: string }).recordId))
      for (const id of ids) if (!ok.has(id)) problems.push(id)
    }

    // Images embedded in rich text (upload nodes) must be approved on a public record.
    if (isPublic && opts.uploads) {
      const ids = opts.uploads(doc).filter((r) => r.collection === 'media').map((r) => r.id)
      if (ids.length) {
        const { docs } = await req.payload.find({
          collection: 'media',
          overrideAccess: true,
          req,
          depth: 0,
          limit: ids.length,
          pagination: false,
          where: { and: [{ id: { in: ids } }, { tenant: { equals: tenant } }, { status: { equals: 'approved' } }] },
        })
        const ok = new Set(docs.map((d) => String(d.id)))
        for (const id of ids) if (!ok.has(String(id))) problems.push(`media #${id}`)
      }
    }

    if (problems.length) {
      throw new ValidationError({
        collection: collection.slug,
        errors: problems.map((id) => ({
          path: 'references',
          message: isPublic
            ? `${id} is missing from this site or not public (internal, investor-only, retired, unapproved or unreleased).`
            : `${id} is missing from this site.`,
        })),
      })
    }
    return data
  }

export const pageReferences = publicReferences({
  collect: (p) => [p.product, p.blocks, p.seo, p.body],
  uploads: (p) => richTextRefs(p.body),
  approved: (p) => p.status === 'approved',
  // A gated page (investor, trust, partner) is shown behind sign-in, so it may cite gated
  // records; a public, ungated page cites public records only.
  isPublic: (p) => p.visibility === 'public' && (!p.gate || p.gate === 'none'),
})
