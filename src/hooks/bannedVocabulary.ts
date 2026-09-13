import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Publish-time vocabulary gate (DeepSeek review 2026-09-13): the CI
 * lint-banned-vocab gate only sees git diffs; this hook applies the same
 * estate rule to content saved through the CMS — the retired terms
 * "Ayra Platform" / "SuperApp" / "Super App" never reach the database.
 */
const BANNED = [/Ayra\s+Platform/i, /Super\s*App/i]

function offendingTerms(text: string): string[] {
  const found: string[] = []
  for (const pattern of BANNED) {
    const match = text.match(pattern)
    if (match) found.push(match[0])
  }
  return found
}

export const bannedVocabularyBeforeChange: CollectionBeforeChangeHook = async ({ data }) => {
  const haystack = JSON.stringify({
    title: data.title,
    excerpt: data.excerpt,
    metaDescription: data.metaDescription,
    content: data.content,
    bio: data.bio,
    description: data.description,
  })

  const found = offendingTerms(haystack)
  if (found.length > 0) {
    throw new Error(
      `Banned vocabulary in content: ${found.map((t) => `"${t}"`).join(', ')}. These terms are retired — use the plugins vocabulary (see the estate AGENTS.md).`,
    )
  }
}
