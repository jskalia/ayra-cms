import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CollectionSlug } from 'payload'
import type { ReactNode } from 'react'

import { fileUrl } from '../../../../../frontend/columns'
import { SITE_COLLECTIONS, sitesFor, when } from '../../../../../frontend/data'
import { citedBy, citesOf, historyOf, sourceLink } from '../../../../../frontend/references'
import { as, requireSession } from '../../../../../frontend/session'
import { Shell } from '../../../../../frontend/Shell'

type Props = { params: Promise<{ collection: string; id: string }> }
type Doc = Record<string, any>

export const metadata = { title: 'Record' }

const join = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : v === undefined || v === null || v === '' ? '—' : String(v))
const by = (a?: Doc) => (a?.by ? `${a.by}${a.at ? ` · ${a.at}` : ''}${a.version ? ` · v${a.version}` : ''}` : '—')
const json = (v: unknown) => (v ? <pre className="cr-json">{JSON.stringify(v, null, 2)}</pre> : '—')

/** The key details of each record kind, as label → value. */
function details(collection: string, d: Doc): [string, ReactNode][] {
  switch (collection) {
    case 'claims':
      return [
        ['Text', d.text], ['Quote', d.quote],
        ['Source', d.source ? `${d.source.path} · ${d.source.lineOrSection} · pinned ${d.source.pinnedDate}` : '—'],
        ['sha256', <span className="mono" key="s">{d.sha256}</span>],
        ['Regulated', d.regulated ? `yes${d.kNumber ? ` · ${d.kNumber}` : ''}${d.platformVsModule ? ` · ${d.platformVsModule}` : ''}` : 'no'],
        ['FDA view', d.fdaView?.signedBy ? `${d.fdaView.signedBy} · ${d.fdaView.signedAt}` : '—'],
        ['Approved', d.approvedBy ? `${d.approvedBy} · ${d.approvedAt}` : '—'],
        ['Superseded by', join(d.supersededBy)], ['Note', join(d.note)],
      ]
    case 'atoms':
      return [['Kind', join(d.kind)], ['Recipe', join(d.recipe)], ['Title', join(d.title)], ['Version', join(d.version)], ['Shape', json(d.shape)]]
    case 'pages':
      return [
        ['Route', <span className="mono" key="r">{d.route}</span>], ['Template', d.template], ['Product', join(d.product)],
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
        ['Preview', fileUrl(d.url) ? <img className="cr-preview" key="p" src={fileUrl(d.url)} alt={d.alt ?? ''} /> : '—'],
        ['Kind', d.kind], ['Alt text', d.alt], ['Licence', join(d.licence)], ['Attribution', join(d.attribution)],
        ['Consent', join(d.consent)], ['File', join(d.filename)], ['sha256', <span className="mono" key="s">{d.sha256 ?? '—'}</span>],
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

/** 9.4 · Record view: details, what it cites, what cites it, sync history, source file. */
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
  const sites = await sitesFor(session)
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
  const pills = [doc.status, doc.visibility, doc.gate && doc.gate !== 'none' ? `gate: ${doc.gate}` : undefined].filter(Boolean)

  return (
    <Shell session={session} sites={sites} active={`/sites/${site.slug}`}>
      <p className="cr-crumbs">
        <Link href={`/sites/${site.slug}`}>{site.name}</Link> / <Link href={`/sites/${site.slug}?tab=${collection}`}>{label}</Link>
      </p>
      <header className="cr-head">
        <div>
          <h1>{doc.title ?? doc.name ?? doc.route ?? doc.recordId}</h1>
          <div className="cr-meta">
            <span className="mono">{doc.recordId}</span>
            {pills.map((p) => (
              <span key={String(p)} className={`cr-pill ${['approved', 'active', 'published', 'public'].includes(String(p)) ? 'ok' : 'warn'}`}>
                {String(p)}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="cr-record">
        <section className="cr-panel" aria-labelledby="h-details">
          <h2 id="h-details">Details</h2>
          <dl className="cr-dl">
            {details(collection, doc).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {doc.body && (
            <>
              <h3>Body</h3>
              <div className="cr-prose">
                <RichText data={doc.body} />
              </div>
            </>
          )}
          {Array.isArray(doc.blocks) && doc.blocks.length > 0 && (
            <>
              <h3>Blocks</h3>
              <ol className="cr-blocks">
                {doc.blocks.map((b: Doc, i: number) => (
                  <li key={b.id ?? i}>
                    <strong className="mono">{b.blockType}</strong>
                    {json(b.props)}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <aside className="cr-side-panels">
          <section className="cr-panel" aria-labelledby="h-source">
            <h2 id="h-source">Source</h2>
            {source ? (
              <p className="cr-small">
                {source.href ? (
                  <a href={source.href} target="_blank" rel="noreferrer">
                    Open in AyraAgent Files ↗
                  </a>
                ) : (
                  'Set SOURCE_FILES_URL_TEMPLATE to link the file.'
                )}
                <br />
                <span className="mono">{source.path}</span>
                <br />
                synced {when(doc.sync?.syncedAt)}
              </p>
            ) : (
              <p className="cr-small">Not from a sync.</p>
            )}
          </section>

          {cites.length > 0 && (
            <section className="cr-panel" aria-labelledby="h-cites">
              <h2 id="h-cites">Cites</h2>
              <ul className="cr-list">
                {cites.map((c) => (
                  <li key={c.ref}>
                    {c.href ? <Link href={c.href} className="mono">{c.ref}</Link> : <span className="mono">{c.ref}</span>}{' '}
                    {!c.found ? <span className="cr-pill bad">missing</span> : !c.isPublic ? <span className="cr-pill warn">not public</span> : <span className="cr-pill ok">public</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {doc.recordId && !['pages', 'posts', 'whats-new'].includes(collection) && (
            <section className="cr-panel" aria-labelledby="h-usedby">
              <h2 id="h-usedby">Cited by</h2>
              {usedBy.length ? (
                <ul className="cr-list">
                  {usedBy.map((u) => (
                    <li key={`${u.collection}-${u.id}`}>
                      <Link href={`/records/${u.collection}/${u.id}`}>{u.label}</Link> <span className="cr-small">{u.collection}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cr-small">Nothing cites this yet.</p>
              )}
            </section>
          )}

          <section className="cr-panel" aria-labelledby="h-history">
            <h2 id="h-history">Sync history</h2>
            {history.length ? (
              <ul className="cr-list">
                {history.map((h) => (
                  <li key={h.receiptId}>
                    <Link href={`/receipts/${h.id}`}>rev {h.revision}</Link> · {h.action} · {when(h.finishedAt)} · {h.actor}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cr-small">No receipts mention this record.</p>
            )}
          </section>
        </aside>
      </div>
    </Shell>
  )
}
