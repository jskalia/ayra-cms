import { requireSession } from '../../../../../frontend/session'
import { runBlogImport } from '../../../../../sync/blogs'

/** The control room's "Import from AyraAgent" button (admins): runs the blog import for one site now. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await requireSession(`/sites/${slug}`)
  if (!session.isAdmin) return new Response('Only an admin can start an import.', { status: 403 })
  const [result] = await runBlogImport({
    payload: session.payload,
    site: slug,
    actor: `${session.user.name ?? session.user.email} (control room)`,
  })
  const q = new URLSearchParams({ tab: 'posts' })
  if (!result) q.set('import', 'not-configured')
  else if (!result.ok) q.set('import', `problem: ${result.problems[0] ?? 'unknown'}`)
  else q.set('import', `${result.counts.create} new · ${result.counts.update} updated · ${result.counts.retire} retired · ${result.counts.unchanged} unchanged`)
  // 303: after a form POST, the browser follows with a GET (a 307 would repeat the POST).
  return Response.redirect(new URL(`/sites/${slug}?${q.toString()}`, request.url), 303)
}
