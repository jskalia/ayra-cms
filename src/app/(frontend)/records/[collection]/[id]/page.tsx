import { RichText } from '@payloadcms/richtext-lexical/react'
import { ExternalLink, FileText, History, Link2, Quote, Shapes } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CollectionSlug } from 'payload'
import type { ReactNode } from 'react'

import { fileUrl } from '../../../../../frontend/columns'
import { SITE_COLLECTIONS, sitesWithStatus, when } from '../../../../../frontend/data'
import { citedBy, citesOf, historyOf, sourceLink } from '../../../../../frontend/references'
import { as, requireSession } from '../../../../../frontend/session'
import { Shell } from '../../../../../frontend/Shell'
import { Badge, Card, CardHeader, DetailList, Dot, EmptyState, Mono, PageHeader, StatusBadge } from '../../../../../frontend/ui'

type Props = { params: Promise<{ collection: string; id: string }> }
type Doc = Record<string, any>

export const metadata = { title: 'Record' }

const join = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : v === undefined || v === null || v === '' ? '—' : String(v))
const by = (a?: Doc) => (a?.by ? `${a.by}${a.at ? ` · ${a.at}` : ''}${a.version ? ` · v${a.version}` : ''}` : '—')
const json = (v: unknown) =>
  v ? <pre className="cr-scroll max-h-72 overflow-auto rounded-[10px] border border-border bg-surface-2 p-3 font-mono text-[12px] leading-relaxed">{JSON.stringify(v, null, 2)}</pre> : '—'

/** The key details of each record kind, as label → value. */
function details(collection: string, d: Doc): [string, ReactNode][] {
  switch (collection) {
    case 'claims':
      return [
        ['Text', d.text], ['Quote', d.quote],
        ['Source', d.source ? `${d.source.path} · ${d.source.lineOrSection} · pinned ${d.source.pinnedDate}` : '—'],
        ['sha256', <span className="font-mono text-[12px] break-all" key="s">{d.sha256}</span>],
        ['Regulated', d.regulated ? `yes${d.kNumber ? ` · ${d.kNumber}` : ''}${d.platformVsModule ? ` · ${d.platformVsModule}` : ''}` : 'no'],
        ['FDA view', d.fdaView?.signedBy ? `${d.fdaView.signedBy} · ${d.fdaView.signedAt}` : '—'],
        ['Approved', d.approvedBy ? `${d.approvedBy} · ${d.approvedAt}` : '—'],
        ['Superseded by', join(d.supersededBy)], ['Note', join(d.note)],
      ]
    case 'atoms':
      return [['Kind', join(d.kind)], ['Recipe', join(d.recipe)], ['Title', join(d.title)], ['Version', join(d.version)], ['Shape', json(d.shape)]]
    case 'pages':
      return [
        ['Route', <span className="font-mono text-[12.5px]" key="r">{d.route}</span>], ['Template', d.template], ['Product', join(d.product)],
        ['Gate', d.gate], ['Owner', join(d.owner)], ['Review by', join(d.reviewBy)], ['Approved', by(d.approved)],
        ['SEO', d.seo ? `${d.seo.title ?? '—'} — ${d.seo.description ?? ''}` : '—'],
      ]
    case 'posts':
      return [
        ['Slug', d.slug], ['Excerpt', join(d.excerpt)], ['Author', d.author?.name ? `${d.author.name}${d.author.jobTitle ? `, ${d.author.jobTitle}` : ''}` : '—'],
        ['Tags', join(d.tags)], ['Published', d.publishedAt ? String(d.publishedAt).slice(0, 10) : '—'], ['Approved', by(d.approved)],
      ]
    case 'media':
      return [
        ['Preview', fileUrl(d.url) ? <img className="max-h-72 rounded-[10px] border border-border" key="p" src={fileUrl(d.url)} alt={d.alt ?? ''} /> : '—'],
        ['Kind', d.kind], ['Alt text', d.alt], ['Licence', join(d.licence)], ['Attribution', join(d.attribution)],
        ['Consent', join(d.consent)], ['File', join(d.filename)], ['sha256', <span className="font-mono text-[12px] break-all" key="s">{d.sha256 ?? '—'}</span>],
      ]
    case 'products':
      return [['Name', d.name], ['Released', d.released ? 'yes' : 'no'], ['Status', join(d.status)], ['product.md', json(d.record)]]
    case 'whats-new':
      return [
        ['Product', join(d.product)], ['Version', join(d.version)], ['Released', d.releasedAt ? String(d.releasedAt).slice(0, 10) : '—'],
        ['Summary', join(d.summary)], ['Tier', join(d.tier)], ['What shipped', join(d.whatShipped)], ['Canonical URL', join(d.canonicalUrl)],
        ['Features (internal)', d.features?.length ? d.features.map((f: Doc) => `${f.name} (${f.state})`).join(', ') : '—'],
        ['Entry approved', by(d.approvals?.entry)],
      ]
    default:
      return []
  }
}

/** 9.4 / 10.4 · Record view: the record itself, then what it cites, what cites it, its source and sync history. */
export default async function RecordPage({ params }: Props) {
  const { collection, id } = await params
  if (!SITE_COLLECTIONS.some((c) => c.slug === collection)) notFound()
  const session = await requireSession(`/records/${collection}/${id}`)
  let doc: Doc
  try {
    doc = (await session.payload.findByID({ collection: collection as CollectionSlug, id, ...as(session), depth: 0 })) as Doc
  } catch {
    notFound() // missing, or not in a site this person may see
  }
  const sites = await sitesWithStatus(session)
  const tenant = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant
  const site = sites.find((s) => String(s.id) === String(tenant))
  if (!site) notFound()

  const label = SITE_COLLECTIONS.find((c) => c.slug === collection)!.label
  const [cites, usedBy, history, source] = await Promise.all([
    citesOf(session, tenant, collection, doc),
    doc.recordId ? citedBy(session, tenant, doc.recordId) : Promise.resolve([]),
    doc.recordId ? historyOf(session, tenant, collection, doc.recordId) : Promise.resolve([]),
    sourceLink(session, tenant, doc.sync?.sourcePath),
  ])
  const facts = details(collection, doc)
  const hasBlocks = Array.isArray(doc.blocks) && doc.blocks.length > 0
  const showCitedBy = doc.recordId && !['pages', 'posts', 'whats-new'].includes(collection)

  return (
    <Shell session={session} sites={sites} active={`/sites/${site.slug}`}>
      <PageHeader
        crumbs={[{ href: `/sites/${site.slug}`, label: site.name }, { href: `/sites/${site.slug}?tab=${collection}`, label }]}
        title={doc.title ?? doc.name ?? doc.route ?? doc.recordId ?? doc.anonymousId}
        meta={
          <>
            {doc.recordId && <Mono className="rounded-md bg-surface-2 px-1.5 py-0.5">{doc.recordId}</Mono>}
            {doc.status && <StatusBadge value={doc.status} />}
            {doc.visibility && <StatusBadge value={doc.visibility} />}
            {doc.gate && doc.gate !== 'none' && <Badge tone="warn">gate: {doc.gate}</Badge>}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {facts.length > 0 && (
            <Card i={1} aria-labelledby="h-details">
              <CardHeader id="h-details" title="Details" icon={<FileText />} />
              <DetailList items={facts} />
            </Card>
          )}
          {doc.body && (
            <Card i={2} aria-labelledby="h-body">
              <CardHeader id="h-body" title="Body" icon={<Quote />} />
              <div className="cr-prose px-4 pb-5">
                <RichText data={doc.body} />
              </div>
            </Card>
          )}
          {hasBlocks && (
            <Card i={3} aria-labelledby="h-blocks">
              <CardHeader id="h-blocks" title="Blocks" icon={<Shapes />} count={doc.blocks.length} />
              <ol className="flex flex-col gap-3 px-4 pb-4">
                {doc.blocks.map((b: Doc, i: number) => (
                  <li key={b.id ?? i} className="rounded-[12px] border border-border p-3">
                    <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                      <span className="flex size-5 items-center justify-center rounded-md bg-surface-2 font-mono text-[11px] text-muted">{i + 1}</span>
                      <Mono>{b.blockType}</Mono>
                    </p>
                    {json(b.props)}
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {facts.length === 0 && !doc.body && !hasBlocks && (
            <Card i={1}>
              <EmptyState title="Nothing more to show">This record has no details beyond its id and status.</EmptyState>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4" aria-label="About this record">
          <Card i={2} aria-labelledby="h-source">
            <CardHeader id="h-source" title="Source" icon={<FileText />} />
            <div className="px-4 pb-4 text-[13px]">
              {source ? (
                <>
                  <p className="font-mono text-[12px] break-all text-muted">{source.path}</p>
                  <p className="mt-1.5 text-[12.5px] text-muted">synced {when(doc.sync?.syncedAt)}</p>
                  {source.href ? (
                    <a href={source.href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline">
                      Open in AyraAgent Files <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : (
                    <p className="mt-2 text-[12px] text-faint">Set SOURCE_FILES_URL_TEMPLATE to link the file.</p>
                  )}
                </>
              ) : (
                <p className="text-muted">Not from a sync.</p>
              )}
            </div>
          </Card>

          {cites.length > 0 && (
            <Card i={3} aria-labelledby="h-cites">
              <CardHeader id="h-cites" title="Cites" icon={<Link2 />} count={cites.length} />
              <ul className="flex flex-col gap-0.5 px-2 pb-2">
                {cites.map((c) => (
                  <li key={c.ref} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5">
                    {c.href ? (
                      <Link href={c.href} className="min-w-0 flex-1 truncate font-mono text-[12px] hover:text-accent">
                        {c.ref}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{c.ref}</span>
                    )}
                    {!c.found ? <Badge tone="bad">missing</Badge> : !c.isPublic ? <Badge tone="warn">not public</Badge> : <Badge tone="ok">public</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {showCitedBy && (
            <Card i={4} aria-labelledby="h-usedby">
              <CardHeader id="h-usedby" title="Cited by" icon={<Link2 />} count={usedBy.length} />
              {usedBy.length ? (
                <ul className="flex flex-col gap-0.5 px-2 pb-2">
                  {usedBy.map((u) => (
                    <li key={`${u.collection}-${u.id}`}>
                      <Link href={`/records/${u.collection}/${u.id}`} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 hover:bg-surface-2">
                        <span className="min-w-0 flex-1 truncate text-[13px]">{u.label}</span>
                        <span className="text-[11.5px] text-faint">{u.collection}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 pb-4 text-[13px] text-muted">Nothing cites this yet.</p>
              )}
            </Card>
          )}

          <Card i={5} aria-labelledby="h-history">
            <CardHeader id="h-history" title="Sync history" icon={<History />} />
            {history.length ? (
              <ol className="relative mx-4 mb-4 border-l border-border">
                {history.map((h) => (
                  <li key={h.receiptId} className="relative pb-3 pl-4 last:pb-0">
                    <Dot tone={h.action === 'create' ? 'ok' : 'info'} className="absolute top-1.5 -left-[4.5px]" />
                    <Link href={`/receipts/${h.id}`} className="text-[13px] font-semibold hover:text-accent">
                      rev {h.revision} · {h.action}
                    </Link>
                    <p className="text-[12px] text-muted">
                      {when(h.finishedAt)} · {h.actor}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 pb-4 text-[13px] text-muted">No receipts mention this record.</p>
            )}
          </Card>
        </aside>
      </div>
    </Shell>
  )
}
