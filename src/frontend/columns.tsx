import type { ReactNode } from 'react'

/** What each site tab lists: the columns, which fields filters and search use. */
type Row = Record<string, any>
export type Column = { label: string; cell: (r: Row) => ReactNode; mono?: boolean }
export type TabDef = {
  title: (r: Row) => string
  columns: Column[]
  searchFields: string[]
  filters: { field: string; label: string; options: string[] }[]
}

const pill = (value: unknown, kind?: string) =>
  value === undefined || value === null || value === '' ? '—' : <span className={`cr-pill ${kind ?? String(value)}`}>{String(value)}</span>
const short = (text: unknown, n = 90) => {
  const s = String(text ?? '')
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
const today = () => new Date().toISOString().slice(0, 10)
/** Files served by this CMS are linked by path (works on any host); Blob URLs stay absolute. */
export const fileUrl = (url?: string | null) => {
  if (!url) return undefined
  try {
    const u = new URL(url)
    return u.pathname.startsWith('/cms-api/') ? u.pathname : url
  } catch {
    return url
  }
}
const reviewBy = (r: Row) =>
  r.reviewBy ? <span className={r.status === 'approved' && r.reviewBy < today() ? 'cr-late' : undefined}>{r.reviewBy}</span> : '—'
const VIS = { field: 'visibility', label: 'Visibility', options: ['public', 'internal', 'investor-only'] }

export const TABS: Record<string, TabDef> = {
  pages: {
    title: (r) => r.route,
    searchFields: ['route', 'recordId'],
    filters: [{ field: 'status', label: 'Status', options: ['approved', 'draft', 'retired'] }, VIS, { field: 'gate', label: 'Gate', options: ['none', 'investor', 'trust', 'partner'] }],
    columns: [
      { label: 'Route', cell: (r) => r.route, mono: true },
      { label: 'Template', cell: (r) => r.template },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'approved' ? 'ok' : undefined) },
      { label: 'Visibility', cell: (r) => pill(r.visibility, r.visibility === 'public' ? 'ok' : 'warn') },
      { label: 'Gate', cell: (r) => (r.gate && r.gate !== 'none' ? pill(r.gate, 'warn') : '—') },
      { label: 'Owner', cell: (r) => r.owner ?? '—' },
      { label: 'Review by', cell: reviewBy, mono: true },
      { label: 'Approved', cell: (r) => (r.approved?.by ? `${r.approved.by} · ${r.approved.at ?? ''}` : '—') },
    ],
  },
  posts: {
    title: (r) => r.title,
    searchFields: ['title', 'slug'],
    filters: [{ field: 'status', label: 'Status', options: ['approved', 'draft', 'retired'] }, VIS],
    columns: [
      { label: 'Title', cell: (r) => r.title },
      { label: 'Slug', cell: (r) => r.slug, mono: true },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'approved' ? 'ok' : undefined) },
      { label: 'Visibility', cell: (r) => pill(r.visibility, r.visibility === 'public' ? 'ok' : 'warn') },
      { label: 'Author', cell: (r) => r.author?.name ?? '—' },
      { label: 'Published', cell: (r) => (r.publishedAt ? String(r.publishedAt).slice(0, 10) : '—'), mono: true },
    ],
  },
  claims: {
    title: (r) => r.recordId,
    searchFields: ['recordId', 'text'],
    filters: [VIS, { field: 'status', label: 'Status', options: ['active', 'deprecated', 'retired'] }, { field: 'regulated', label: 'Regulated', options: ['true', 'false'] }],
    columns: [
      { label: 'Claim', cell: (r) => r.recordId, mono: true },
      { label: 'Text', cell: (r) => short(r.text) },
      { label: 'Visibility', cell: (r) => pill(r.visibility, r.visibility === 'public' ? 'ok' : 'warn') },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'active' ? 'ok' : 'warn') },
      { label: 'Regulated', cell: (r) => (r.regulated ? pill(r.kNumber ?? 'regulated', 'warn') : '—') },
      { label: 'Product', cell: (r) => r.product ?? '—', mono: true },
    ],
  },
  atoms: {
    title: (r) => r.recordId,
    searchFields: ['recordId', 'title'],
    filters: [VIS, { field: 'status', label: 'Status', options: ['active', 'deprecated', 'retired'] }],
    columns: [
      { label: 'Atom', cell: (r) => r.recordId, mono: true },
      { label: 'Kind', cell: (r) => r.kind ?? '—' },
      { label: 'Recipe', cell: (r) => r.recipe ?? '—', mono: true },
      { label: 'Title', cell: (r) => r.title ?? '—' },
      { label: 'Visibility', cell: (r) => pill(r.visibility, r.visibility === 'public' ? 'ok' : 'warn') },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'active' ? 'ok' : 'warn') },
    ],
  },
  media: {
    title: (r) => r.recordId,
    searchFields: ['recordId', 'alt'],
    filters: [{ field: 'status', label: 'Status', options: ['approved', 'draft', 'retired'] }],
    columns: [
      { label: '', cell: (r) => { const src = fileUrl(r.sizes?.thumbnail?.url || r.url); return src ? <img className="cr-thumb" src={src} alt="" /> : null } },
      { label: 'Asset', cell: (r) => r.recordId, mono: true },
      { label: 'Kind', cell: (r) => r.kind },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'approved' ? 'ok' : undefined) },
      { label: 'Alt text', cell: (r) => short(r.alt, 60) },
      { label: 'Licence', cell: (r) => r.licence ?? '—' },
    ],
  },
  products: {
    title: (r) => r.name,
    searchFields: ['name', 'recordId'],
    filters: [{ field: 'released', label: 'Released', options: ['true', 'false'] }],
    columns: [
      { label: 'Product', cell: (r) => r.name },
      { label: 'Id', cell: (r) => r.recordId, mono: true },
      { label: 'Released', cell: (r) => (r.released ? pill('released', 'ok') : pill('unreleased', 'warn')) },
      { label: 'Status', cell: (r) => r.status ?? '—' },
    ],
  },
  'whats-new': {
    title: (r) => r.title ?? r.recordId,
    searchFields: ['recordId', 'title', 'summary'],
    filters: [{ field: 'status', label: 'Status', options: ['published', 'approved', 'draft', 'withdrawn'] }, VIS],
    columns: [
      { label: 'Release', cell: (r) => r.recordId, mono: true },
      { label: 'Product', cell: (r) => r.product ?? '—', mono: true },
      { label: 'Released', cell: (r) => (r.releasedAt ? String(r.releasedAt).slice(0, 10) : '—'), mono: true },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'published' || r.status === 'approved' ? 'ok' : undefined) },
      { label: 'Visibility', cell: (r) => pill(r.visibility, r.visibility === 'public' ? 'ok' : 'warn') },
      { label: 'Summary', cell: (r) => short(r.summary, 70) },
    ],
  },
  legal: {
    title: (r) => r.recordId,
    searchFields: ['recordId', 'type', 'changeSummary'],
    filters: [{ field: 'status', label: 'Status', options: ['published', 'superseded', 'approved', 'draft'] }],
    columns: [
      { label: 'Type', cell: (r) => r.type, mono: true },
      { label: 'Version', cell: (r) => r.version, mono: true },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'published' ? 'ok' : r.status === 'superseded' ? undefined : 'warn') },
      { label: 'Effective', cell: (r) => r.effectiveAt ?? '—', mono: true },
      { label: 'Material', cell: (r) => (r.material ? pill('material', 'warn') : '—') },
      { label: 'Change', cell: (r) => short(r.changeSummary, 70) },
    ],
  },
  decks: {
    title: (r) => r.title,
    searchFields: ['title', 'recordId'],
    filters: [{ field: 'status', label: 'Status', options: ['approved', 'draft', 'retired'] }, { field: 'gate', label: 'Gate', options: ['none', 'investor', 'partner'] }],
    columns: [
      { label: 'Deck', cell: (r) => r.title },
      { label: 'Id', cell: (r) => r.recordId, mono: true },
      { label: 'Gate', cell: (r) => (r.gate && r.gate !== 'none' ? pill(r.gate, 'warn') : '—') },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'approved' ? 'ok' : undefined) },
      { label: 'Source', cell: (r) => short(r.source, 50), mono: true },
    ],
  },
  'trust-documents': {
    title: (r) => r.title,
    searchFields: ['title', 'recordId', 'type'],
    filters: [{ field: 'status', label: 'Status', options: ['approved', 'draft', 'superseded', 'retired'] }],
    columns: [
      { label: 'Document', cell: (r) => r.title },
      { label: 'Type', cell: (r) => r.type ?? '—', mono: true },
      { label: 'Version', cell: (r) => r.version ?? '—', mono: true },
      { label: 'Effective', cell: (r) => r.effectiveAt ?? '—', mono: true },
      { label: 'Owner', cell: (r) => r.owner ?? '—' },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'approved' ? 'ok' : undefined) },
    ],
  },
  audiences: {
    title: (r) => r.name,
    searchFields: ['name', 'recordId', 'summary'],
    filters: [VIS, { field: 'status', label: 'Status', options: ['active', 'deprecated', 'retired'] }],
    columns: [
      { label: 'Audience', cell: (r) => r.name },
      { label: 'Id', cell: (r) => r.recordId, mono: true },
      { label: 'Visibility', cell: (r) => pill(r.visibility, r.visibility === 'public' ? 'ok' : 'warn') },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'active' ? 'ok' : 'warn') },
      { label: 'Summary', cell: (r) => short(r.summary, 70) },
    ],
  },
  workflows: {
    title: (r) => r.name,
    searchFields: ['name', 'recordId', 'summary'],
    filters: [VIS, { field: 'status', label: 'Status', options: ['active', 'deprecated', 'retired'] }],
    columns: [
      { label: 'Workflow', cell: (r) => r.name },
      { label: 'Id', cell: (r) => r.recordId, mono: true },
      { label: 'Visibility', cell: (r) => pill(r.visibility, r.visibility === 'public' ? 'ok' : 'warn') },
      { label: 'Status', cell: (r) => pill(r.status, r.status === 'active' ? 'ok' : 'warn') },
      { label: 'Summary', cell: (r) => short(r.summary, 70) },
    ],
  },
  'consent-records': {
    title: (r) => r.anonymousId,
    searchFields: ['anonymousId', 'policyVersion'],
    filters: [{ field: 'region', label: 'Region', options: ['us', 'eu-uk', 'other'] }],
    columns: [
      { label: 'Anonymous id', cell: (r) => short(r.anonymousId, 24), mono: true },
      { label: 'Choices', cell: (r) => Object.entries(r.choices ?? {}).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(' · ') || '—' },
      { label: 'Policy', cell: (r) => r.policyVersion, mono: true },
      { label: 'GPC', cell: (r) => (r.gpc ? pill('GPC', 'warn') : '—') },
      { label: 'Region', cell: (r) => r.region ?? '—' },
      { label: 'Recorded', cell: (r) => (r.recordedAt ? String(r.recordedAt).slice(0, 16).replace('T', ' ') : '—'), mono: true },
    ],
  },
}
