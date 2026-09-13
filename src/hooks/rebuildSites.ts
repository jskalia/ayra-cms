import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/**
 * Content → site rebuilds (the Vite answer to slai-web's ISR):
 * on PRODUCTION PUBLISH state changes of content collections, fire both
 * sites' Vercel deploy hooks so they rebuild with fresh /cms-api content.
 *
 * Publish-gated (DeepSeek review 2026-09-13): draft saves and autosaves do
 * NOT trigger rebuilds — only transitions involving a published doc do
 * (publish, edit-of-published, unpublish). Deletes are conservative: always
 * fire (a deleted doc may have been published).
 */
function isPublishRelevant(doc?: { _status?: string }, previousDoc?: { _status?: string }): boolean {
  return doc?._status === 'published' || previousDoc?._status === 'published'
}

async function triggerSiteRebuilds(): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') return

  const hooks = [
    process.env.DEPLOY_HOOK_AYRAAGENTAI_WEB_URL,
    process.env.DEPLOY_HOOK_HEYAYRAAI_WEB_URL,
  ].filter((u): u is string => Boolean(u))

  await Promise.allSettled(
    hooks.map((url) =>
      fetch(url, { method: 'POST' }).catch((err) => {
        console.warn(`[rebuild-sites] deploy hook failed: ${err instanceof Error ? err.message : String(err)}`)
      }),
    ),
  )
}

export const rebuildSitesAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc }) => {
  if (!isPublishRelevant(doc, previousDoc)) return
  await triggerSiteRebuilds()
}

export const rebuildSitesAfterDelete: CollectionAfterDeleteHook = async () => {
  await triggerSiteRebuilds()
}
