import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Records in _ops keep their long-form text as Markdown (page.md body). The sync sends it as
 * `bodyMarkdown`; this turns it into the rich-text `body` the sites render (article-body,
 * legal-body), with the CMS's own editor configuration. Runs first, so the citation and
 * same-site checks see the converted body.
 */
export const markdownBody: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  // Only a Markdown string from the sync drives the body ("" means "no body"). Anything else
  // (absent, null) leaves the body as it is.
  const markdown = data?.bodyMarkdown
  if (!data || typeof markdown !== 'string') return data
  if (markdown.trim() === '') {
    data.body = null
    return data
  }
  if (originalDoc && originalDoc.bodyMarkdown === markdown && originalDoc.body) return data
  const editorConfig = await editorConfigFactory.default({ config: req.payload.config })
  data.body = convertMarkdownToLexical({ editorConfig, markdown })
  return data
}
