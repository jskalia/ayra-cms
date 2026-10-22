import { requireSession } from '../../../../../frontend/session'
import { decidePost, type Decision } from '../../../../../sync/approval'

/** The review page's Approve and Send back buttons. The rules (who, which blogs) live in sync/approval.ts. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession(`/blogs/${id}`)
  const form = await request.formData()
  const decision = form.get('decision')
  if (decision !== 'approve' && decision !== 'send-back') return new Response('Unknown decision.', { status: 400 })

  const result = await decidePost({ payload: session.payload, user: session.user, postId: id, decision: decision as Decision })
  const q = new URLSearchParams()
  if (result.ok) {
    q.set('done', decision)
    if (result.deployHook === 'failed') q.set('note', 'deploy-failed')
  } else q.set('error', result.message.slice(0, 300))
  return Response.redirect(new URL(`/blogs/${id}?${q.toString()}`, request.url), 303)
}
