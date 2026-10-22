import { RichText } from '@payloadcms/richtext-lexical/react'
import { Check, CheckCircle2, Clock, FileText, Globe, ListChecks, Monitor, RotateCcw, Smartphone, TriangleAlert, Type, X } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { reviewChecks, sourceCount, STATE_LABEL, wordCount } from '../../../../frontend/blogs'
import { sitesWithStatus, when } from '../../../../frontend/data'
import { as, requireSession } from '../../../../frontend/session'
import { Shell } from '../../../../frontend/Shell'
import { Badge, Button, Card, CardHeader, cn, PageHeader } from '../../../../frontend/ui'
import { canApprove } from '../../../../sync/approval'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }
type Doc = Record<string, any>

export const metadata = { title: 'Review blog' }

const VIEWS = [
  { key: 'website', label: 'Website', icon: Monitor },
  { key: 'phone', label: 'Phone', icon: Smartphone },
  { key: 'raw', label: 'Raw text', icon: Type },
] as const

const DONE: Record<string, string> = {
  approve: 'Approved. It goes live on the website’s next deploy.',
  'send-back': 'Sent back. It stays off the website until AyraAgent publishes a new version.',
}

/** 12.4 · Review a blog: read it as the website will show it, see what to check, then approve or send it back. */
export default async function ReviewBlog({ params, searchParams }: Props) {
  const { id } = await params
  const query = await searchParams
  const session = await requireSession(`/blogs/${id}`)
  let doc: Doc
  try {
    doc = (await session.payload.findByID({ collection: 'posts', id, ...as(session), depth: 0 })) as Doc
  } catch {
    notFound() // missing, or not in a site this person may see
  }
  const sites = await sitesWithStatus(session)
  const tenantId = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant
  const site = sites.find((s) => String(s.id) === String(tenantId))
  if (!site) notFound()

  const [settings] = (await session.payload.find({ collection: 'site-settings', ...as(session), where: { tenant: { equals: tenantId } }, limit: 1, depth: 0 })).docs as Doc[]
  const domain: string | undefined = settings?.domains?.primary

  const view = VIEWS.find((v) => v.key === query.view)?.key ?? 'website'
  const review = doc.review ?? {}
  const fromAyra = doc.origin === 'ayra-blogs'
  const mayDecide = fromAyra && doc.status === 'draft' && canApprove(session.user, tenantId)
  const state = STATE_LABEL(doc.status, review.state)
  const checks = reviewChecks(doc)
  const sources: { n?: number; file?: string; path?: string }[] = Array.isArray(doc.sources) ? doc.sources : []
  const done = query.done && DONE[query.done]
  const view_ = (v: string) => `/blogs/${id}?view=${v}`

  const article = (
    <article className="cr-paper px-6 py-7 sm:px-9 sm:py-9">
      <p className="font-mono text-[11px]">{domain ?? site.name}/whats-new/{doc.slug}</p>
      <h2 className="mt-3 text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">{doc.title}</h2>
      <p className="mt-2.5 text-[13px]" style={{ color: 'var(--muted)' }}>
        {doc.author?.name ? `By ${doc.author.name}` : 'No author set'}
        {doc.author?.jobTitle ? `, ${doc.author.jobTitle}` : ''}
        {doc.publishedAt ? ` · ${String(doc.publishedAt).slice(0, 10)}` : ''}
      </p>
      {doc.excerpt && (
        <p className="mt-5 text-[16px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          {doc.excerpt}
        </p>
      )}
      <div className="cr-prose mt-6">{doc.body ? <RichText data={doc.body} /> : <p>This blog has no body yet.</p>}</div>
    </article>
  )

  return (
    <Shell session={session} sites={sites} active="/">
      <PageHeader
        crumbs={[{ href: '/', label: 'Blogs' }, { href: `/?site=${site.slug}`, label: site.name }]}
        title={doc.title}
        meta={
          <>
            <Badge tone={doc.status === 'approved' ? 'ok' : doc.status === 'retired' ? 'neutral' : review.state === 'sent-back' ? 'info' : 'warn'} dot>
              {state}
            </Badge>
            <Badge tone="accent">{site.name}</Badge>
            {doc.status === 'draft' && review.previouslyApproved && <Badge tone="warn">edited after approval</Badge>}
            <span>
              {wordCount(doc.bodyMarkdown).toLocaleString('en')} words · {sourceCount(doc.sources)} sources
            </span>
          </>
        }
        actions={
          mayDecide && (
            <div className="flex flex-wrap gap-2">
              {review.state !== 'sent-back' && (
                <form action={`/blogs/${id}/decision`} method="post">
                  <input type="hidden" name="decision" value="send-back" />
                  <Button type="submit" variant="secondary">
                    <RotateCcw className="size-3.5" aria-hidden /> Send back
                  </Button>
                </form>
              )}
              <form action={`/blogs/${id}/decision`} method="post">
                <input type="hidden" name="decision" value="approve" />
                <Button type="submit" variant="primary">
                  <Check className="size-3.5" aria-hidden /> Approve and publish
                </Button>
              </form>
            </div>
          )
        }
      />

      {done && (
        <p role="status" className="cr-rise mb-4 flex items-center gap-2 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px]">
          <CheckCircle2 className="size-4 text-ok" aria-hidden /> {done}
          {query.note === 'deploy-failed' && ' The website deploy could not be started; ask an admin to start it.'}
          <Link href="/" className="ml-auto font-semibold text-accent hover:underline">
            Back to blogs
          </Link>
        </p>
      )}
      {query.error && (
        <p role="alert" className="cr-rise mb-4 flex items-center gap-2 rounded-[12px] border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-[13px]">
          <X className="size-4 text-bad" aria-hidden /> {query.error.slice(0, 300)}
        </p>
      )}
      {!mayDecide && doc.status === 'draft' && fromAyra && (
        <p className="cr-rise mb-4 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-muted">You can read this blog. An approver for {site.name} decides.</p>
      )}
      {doc.status === 'retired' && (
        <p className="cr-rise mb-4 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-muted">
          This blog was archived in AyraAgent, so it is hidden from the website. Publish it there again to bring it back as a draft.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card i={1} className="min-w-0 overflow-hidden" aria-labelledby="h-preview">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-3">
            <h2 id="h-preview" className="flex items-center gap-2 text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">
              <FileText className="size-4 text-faint" aria-hidden /> Preview
            </h2>
            <nav aria-label="Preview as" className="flex gap-1 rounded-[10px] border border-border bg-surface-2/60 p-0.5">
              {VIEWS.map(({ key, label, icon: Icon }) => (
                <Link
                  key={key}
                  href={view_(key)}
                  aria-current={view === key ? 'true' : undefined}
                  className={cn('inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors', view === key ? 'bg-surface text-text shadow-card' : 'text-muted hover:text-text')}
                >
                  <Icon className="size-3.5" aria-hidden /> {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="bg-surface-2/50 p-3 sm:p-5">
            {view === 'website' && <div className="mx-auto max-w-[780px] overflow-hidden rounded-[12px] border border-border">{article}</div>}
            {view === 'phone' && <div className="mx-auto w-[390px] max-w-full overflow-hidden rounded-[34px] border-[9px] border-border-strong">{article}</div>}
            {view === 'raw' && (
              <pre className="cr-scroll max-h-[70vh] overflow-auto rounded-[12px] border border-border bg-surface p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">{doc.bodyMarkdown ?? ''}</pre>
            )}
          </div>
        </Card>

        <aside className="flex flex-col gap-4" aria-label="About this blog">
          <Card i={2} aria-labelledby="h-checks">
            <CardHeader id="h-checks" title="Checks" icon={<ListChecks />} />
            <ul className="flex flex-col gap-2 px-4 pb-4 text-[13px]">
              {checks.map((c) => (
                <li key={c.text} className="flex items-start gap-2">
                  {c.tone === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <TriangleAlert className={cn('mt-0.5 size-4 shrink-0', c.tone === 'bad' ? 'text-bad' : 'text-warn')} aria-hidden />}
                  <span className={cn(c.tone === 'ok' && 'text-muted')}>{c.text}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card i={3} aria-labelledby="h-sources">
            <CardHeader id="h-sources" title="Sources" icon={<Globe />} count={sources.length} />
            {sources.length ? (
              <ul className="flex flex-col gap-2 px-4 pb-4 text-[13px]">
                {sources.slice(0, 6).map((s, i) => (
                  <li key={i}>
                    <p className="truncate font-medium">
                      <span className="mr-1.5 font-mono text-[11.5px] text-faint">{s.n ?? i + 1}</span>
                      {s.file ?? s.path}
                    </p>
                    {s.path && s.file && <p className="truncate font-mono text-[11.5px] text-faint">{s.path}</p>}
                  </li>
                ))}
                {sources.length > 6 && <li className="text-[12.5px] text-faint">and {sources.length - 6} more</li>}
              </ul>
            ) : (
              <p className="px-4 pb-4 text-[13px] text-muted">The agent cited no files.</p>
            )}
          </Card>

          <Card i={4} aria-labelledby="h-history">
            <CardHeader id="h-history" title="History" icon={<Clock />} />
            <ol className="flex flex-col gap-2 px-4 pb-4 text-[13px] text-muted">
              <li>
                Arrived {when(doc.sync?.syncedAt ?? doc.createdAt)}
                {review.revision ? ` · revision ${review.revision}` : ''}
              </li>
              {review.previouslyApproved && <li>An earlier version was approved</li>}
              {review.decidedBy && review.state === 'sent-back' && (
                <li>
                  Sent back by {review.decidedBy}
                  {review.decidedAt ? ` · ${review.decidedAt}` : ''}
                </li>
              )}
              {doc.status === 'approved' && doc.approved?.by && (
                <li>
                  Approved by {doc.approved.by}
                  {doc.approved.at ? ` · ${doc.approved.at}` : ''}
                </li>
              )}
            </ol>
          </Card>
        </aside>
      </div>
    </Shell>
  )
}
