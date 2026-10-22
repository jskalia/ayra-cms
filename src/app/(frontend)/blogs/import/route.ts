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
  const problem = results.flatMap((r) => r.problems)[0]
  if (!results.length) q.set('import', 'not-configured')
  else if (problem) q.set('import', `problem: ${problem}`)
  else {
    const sum = (k: 'create' | 'update' | 'retire' | 'unchanged') => results.reduce((n, r) => n + r.counts[k], 0)
    q.set('import', `${sum('create')} new · ${sum('update')} updated · ${sum('retire')} retired · ${sum('unchanged')} unchanged`)
  }
  // 303: after a form POST, the browser follows with a GET (a 307 would repeat the POST).
  return Response.redirect(new URL(`/?${q.toString()}`, request.url), 303)
}
