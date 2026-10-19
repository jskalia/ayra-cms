import { ValidationError, type CollectionBeforeValidateHook, type CollectionSlug } from 'payload'

import { roleOf } from '../access/roles'

/**
 * Keeps every document, and everything it links to, inside one tenant. Runs on drafts too
 * (Payload skips field validation on drafts, so the tenant filter on relationship fields is
 * not enough on its own).
 *
 * 1. A non-admin writer must give the document a tenant (no tenant-less orphans).
 * 2. Every referenced document (uploads, relationships, and upload or internal-link nodes in
 *    rich text) must belong to the same tenant; otherwise a writer could point at another
 *    site's records and learn their content through queries.
 */
type Ref = { collection: CollectionSlug; id: number | string }
type RefExtractor = (data: Record<string, unknown>) => Ref[]

const idOf = (v: unknown): number | string | undefined => {
  if (typeof v === 'number' || typeof v === 'string') return v
  if (v && typeof v === 'object' && 'id' in v) return (v as { id: number | string }).id
  return undefined
}

export const refs = (collection: CollectionSlug, value: unknown): Ref[] =>
  (Array.isArray(value) ? value : [value])
    .map(idOf)
    .filter((id): id is number | string => id !== undefined && id !== null && id !== '')
    .map((id) => ({ collection, id }))

/** Upload nodes and internal links inside a Lexical rich-text value. */
export const richTextRefs = (value: unknown): Ref[] => {
  const found: Ref[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as Record<string, unknown>
    if (n.type === 'upload' && typeof n.relationTo === 'string') {
      found.push(...refs(n.relationTo as CollectionSlug, n.value))
    }
    const doc = (n.fields as Record<string, unknown> | undefined)?.doc as Record<string, unknown> | undefined
    if (n.type === 'link' && doc && typeof doc.relationTo === 'string') {
      found.push(...refs(doc.relationTo as CollectionSlug, doc.value))
    }
    for (const child of (n.children as unknown[]) ?? []) walk(child)
    if (n.root) walk(n.root)
  }
  walk(value)
  return found
}

export const sameTenantReferences =
  (extract: RefExtractor = () => []): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req, collection, operation }) => {
    if (!data || roleOf(req) === 'admin') return data
    // A record's id and site never change after it is created: moving or renaming it would
    // silently break every page that cites it.
    // (Payload passes an originalDoc on some creates, e.g. uploads, so test the operation.)
    if (operation === 'update' && originalDoc) {
      const changed = (field: string) =>
        field in data &&
        data[field] !== undefined &&
        originalDoc[field] !== undefined &&
        String(idOf(data[field])) !== String(idOf(originalDoc[field]))
      for (const field of ['recordId', 'tenant']) {
        if (changed(field)) {
          throw new ValidationError({
            collection: collection.slug,
            errors: [{ message: `${field} cannot change after a record is created.`, path: field }],
          })
        }
      }
    }
    const tenant = idOf(data.tenant ?? originalDoc?.tenant)
    if (tenant === undefined) {
      throw new ValidationError({
        collection: collection.slug,
        errors: [{ message: 'A tenant is required.', path: 'tenant' }],
      })
    }

    // One message for every refusal, so a refusal never reveals which site owns a record.
    const refuse = () => {
      throw new ValidationError({
        collection: collection.slug,
        errors: [{ message: 'Not allowed: this links to, or is placed in, another site.', path: 'tenant' }],
      })
    }
    const assigned = ((req.user as { tenants?: { tenant: unknown }[] } | null)?.tenants ?? []).map((t) => idOf(t.tenant))
    if (req.user && !assigned.some((id) => String(id) === String(tenant))) refuse()

    const merged = { ...originalDoc, ...data } as Record<string, unknown>
    const byCollection = new Map<CollectionSlug, Set<number | string>>()
    for (const r of extract(merged)) {
      if (!byCollection.has(r.collection)) byCollection.set(r.collection, new Set())
      byCollection.get(r.collection)!.add(r.id)
    }

    for (const [slug, ids] of byCollection) {
      const { totalDocs } = await req.payload.count({
        collection: slug,
        overrideAccess: true,
        req,
        where: { and: [{ id: { in: [...ids] } }, { tenant: { equals: tenant } }] },
      })
      if (totalDocs !== ids.size) refuse()
    }
    return data
  }
