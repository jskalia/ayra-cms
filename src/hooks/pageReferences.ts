import { ValidationError, type CollectionBeforeValidateHook, type CollectionSlug, type Where } from 'payload'

import { PUBLIC_ACTIVE } from '../access/roles'

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
}
const REF = /^(claim|atom|asset|product):\S+$/

/** Every claim:/atom:/asset:/product: string anywhere inside a value. */
export function collectRefs(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (REF.test(value)) found.add(value)
  } else if (Array.isArray(value)) {
    for (const v of value) collectRefs(v, found)
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectRefs(v, found)
  }
  return found
}

export const pageReferences: CollectionBeforeValidateHook = async ({ data, originalDoc, req, collection }) => {
  const page = { ...originalDoc, ...data } as Record<string, unknown>
  if (page.status !== 'approved') return data
  const tenant = typeof page.tenant === 'object' && page.tenant ? (page.tenant as { id: unknown }).id : page.tenant
  const isPublic = page.visibility === 'public'

  const refs = collectRefs([page.product, page.blocks, (page.seo as Record<string, unknown> | undefined)?.og])
  const byKind = new Map<string, string[]>()
  for (const ref of refs) {
    const kind = ref.split(':')[0]
    byKind.set(kind, [...(byKind.get(kind) ?? []), ref])
  }

  const problems: string[] = []
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

  if (problems.length) {
    throw new ValidationError({
      collection: collection.slug,
      errors: problems.map((id) => ({
        path: 'blocks',
        message: isPublic
          ? `${id} is missing from this site or not public (internal, investor-only, retired, unapproved or unreleased).`
          : `${id} is missing from this site.`,
      })),
    })
  }
  return data
}
