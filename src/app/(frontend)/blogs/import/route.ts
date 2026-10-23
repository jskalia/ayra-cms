import { requireSession } from '../../../../frontend/session'
import { runBlogImport } from '../../../../sync/blogs'

/** The inbox's "Import now" button (admins): reads the published AyraAgent blogs for one site, or every site that has an organization set. */
export async function POST(request: Request) {
  const session = await requireSession('/')
  if (!session.isAdmin) return new Response('Only an admin can start an import.', { status: 403 })
  const form = await request.formData()
  const site = typeof form.get('site') === 'string' && form.get('site') ? String(form.get('site')) : undefined
  const results = await runBlogImport({
    payload: session.payload,
    site,
    actor: `${session.user.name ?? session.user.email} (control room)`,
  })
  const q = new URLSearchParams()
  if (site) q.set('site', site)
  // One line per site, so a setup problem on one site never hides what another site imported.
  if (!results.length) q.set('import', 'not-configured')
  else {
    const line = (r: (typeof results)[number]) =>
      r.problems.length
        ? `${r.site}: ${r.problems[0]}`
        : `${r.site}: ${r.counts.create} new · ${r.counts.update} updated · ${r.counts.retire} retired · ${r.counts.unchanged} unchanged`
    const text = results.map(line).join('  |  ')
    q.set('import', results.some((r) => r.problems.length) ? `problem: ${text}` : text)
  }
  // 303: after a form POST, the browser follows with a GET (a 307 would repeat the POST).
  return Response.redirect(new URL(`/?${q.toString()}`, request.url), 303)
}
