import { ValidationError, type CollectionBeforeChangeHook } from 'payload'

/**
 * Publish-time vocabulary gate (DeepSeek review 2026-09-13): the CI
 * lint-banned-vocab gate only sees git diffs; this hook applies the same
 * estate rule to content saved through the CMS — the retired terms
 * "Ayra Platform" / "SuperApp" / "Super App" never reach the database.
 * It checks the whole record (every field, block props and rich text included).
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

export const bannedVocabularyBeforeChange: CollectionBeforeChangeHook = async ({ data, collection }) => {
  const found = offendingTerms(JSON.stringify(data ?? {}))
  if (found.length > 0) {
    throw new ValidationError({
      collection: collection.slug,
      errors: [
        {
          path: 'content',
          message: `Banned vocabulary: ${found.map((t) => `"${t}"`).join(', ')}. These terms are retired — use the plugins vocabulary (see the estate AGENTS.md).`,
        },
      ],
    })
  }
  return data
}
