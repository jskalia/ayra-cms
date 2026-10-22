/**
 * Approving AyraAgent blogs in the control room (Phase 12).
 *
 * A blog arrives as a draft (src/sync/blogs.ts). A person with the right to approve reads it
 * and either approves it (it becomes public, recording who and when) or sends it back (it stays
 * a draft; the AyraAgent side writes a new version). This is the one place people change
 * content, and it is narrow on purpose:
 *
 *  - who: an admin, or a viewer account assigned to the post's site;
 *  - what: only AyraAgent blogs that are drafts, and only their status, approval and review fields;
 *  - everything else (the text, the slug, the sources) still comes only from the import.
 *
 * The write goes through Payload's Local API, so every rule on a post still runs (a real author
 * is required, an approved post may cite public records only, banned vocabulary).
 */
import type { Payload } from 'payload'

import { callDeployHook, type PostDoc, type Tenant } from './blogs'

export type Approver = { id: number | string; role?: string | null; name?: string | null; email?: string | null; tenants?: unknown }
export type Decision = 'approve' | 'send-back'

const idOf = (v: unknown): string => String(v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

/** The site ids an account is assigned to. */
export const tenantIdsOf = (user: Approver): string[] =>
  (Array.isArray(user.tenants) ? user.tenants : []).map((t) => idOf((t as { tenant?: unknown })?.tenant)).filter((id) => id !== 'undefined' && id !== 'null')

/** Admins approve for every site; a viewer approves for the sites assigned to them. */
export function canApprove(user: Approver, tenantId: unknown): boolean {
  if (user.role === 'admin') return true
  return user.role === 'editor' && tenantIdsOf(user).includes(idOf(tenantId))
}

type Review = { state?: string | null; revision?: string | null; previouslyApproved?: boolean | null }
type BlogPost = PostDoc & { tenant: unknown; review?: Review | null; author?: { name?: string | null } | null }

export type Decided =
  | { ok: true; message: string; deployHook?: 'called' | 'failed' | 'not set' }
  | { ok: false; status: 400 | 403 | 404 | 409 | 422; message: string }

const today = (now: Date) => now.toISOString().slice(0, 10)

export async function decidePost(opts: {
  payload: Payload
  user: Approver
  postId: string | number
  decision: Decision
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
  now?: () => Date
}): Promise<Decided> {
  const { payload, user, postId, decision } = opts
  const now = (opts.now ?? (() => new Date()))()

  let post: BlogPost
  try {
    post = (await payload.findByID({ collection: 'posts', id: postId, overrideAccess: true, depth: 0 })) as unknown as BlogPost
  } catch {
    return { ok: false, status: 404, message: 'That blog was not found.' }
  }
  // Same answer for "not yours" and "not there", so a post of another site is not confirmed to exist.
  if (!canApprove(user, post.tenant)) return { ok: false, status: 404, message: 'That blog was not found.' }
  if (post.origin !== 'ayra-blogs') return { ok: false, status: 400, message: 'Only AyraAgent blogs are approved here.' }
  if (post.status !== 'draft') {
    return { ok: false, status: 409, message: post.status === 'approved' ? 'This blog is already approved.' : 'This blog is retired.' }
  }
  const review = post.review ?? {}
  if (decision === 'send-back' && review.state === 'sent-back') return { ok: false, status: 409, message: 'This blog was already sent back.' }

  const who = String(user.name || user.email || 'unknown')
  const decidedAt = today(now)
  try {
    if (decision === 'approve') {
      await payload.update({
        collection: 'posts', id: postId, overrideAccess: true, depth: 0,
        data: {
          status: 'approved',
          approved: { by: who, at: decidedAt, version: review.revision ?? undefined },
          review: { ...review, state: 'approved', decidedBy: who, decidedAt },
        } as never,
      })
    } else {
      await payload.update({
        collection: 'posts', id: postId, overrideAccess: true, depth: 0,
        data: { review: { ...review, state: 'sent-back', decidedBy: who, decidedAt } } as never,
      })
    }
  } catch (err) {
    // A rule on the post refused it (no author, a private record cited, …): say what, in the rule's words.
    const data = (err as { data?: { errors?: { message?: string }[] } }).data
    const detail = data?.errors?.map((e) => e.message).filter(Boolean).join(' ')
    return { ok: false, status: 422, message: detail || (err instanceof Error ? err.message : 'The blog could not be saved.') }
  }

  if (decision === 'send-back') return { ok: true, message: 'Sent back. It stays out of the website until a new version is approved.' }

  const tenant = (await payload.findByID({ collection: 'tenants', id: idOf(post.tenant), overrideAccess: true, depth: 0 })) as unknown as Tenant
  const deployHook = await callDeployHook(tenant, opts.env ?? process.env, opts.fetch)
  return { ok: true, message: 'Approved. It goes live on the next website deploy.', deployHook }
}
