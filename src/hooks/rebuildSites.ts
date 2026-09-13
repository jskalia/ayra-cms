import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/**
 * Content → site rebuilds (the Vite answer to slai-web's ISR):
 * on production changes to content collections, fire both sites'
 * Vercel deploy hooks so they rebuild with fresh /cms-api content.
 */
async function triggerSiteRebuilds(): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') return

  const hooks = [
    process.env.DEPLOY_HOOK_AYRAAGENTAI_WEB_URL,
    process.env.DEPLOY_HOOK_HEYAYRAAI_WEB_URL,
  ].filter((u): u is string => Boolean(u))

  await Promise.allSettled(hooks.map((url) => fetch(url, { method: 'POST' })))
}

export const rebuildSitesAfterChange: CollectionAfterChangeHook = async () => {
  await triggerSiteRebuilds()
}

export const rebuildSitesAfterDelete: CollectionAfterDeleteHook = async () => {
  await triggerSiteRebuilds()
}
