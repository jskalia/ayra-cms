/**
 * How the sync talks to the CMS. Two implementations with the same access rules:
 *  - RestClient: over HTTP with the sync account's API key (real runs, any environment).
 *  - LocalClient: through Payload's Local API as the sync account (tests); overrideAccess is
 *    off, so every collection rule applies exactly as it does over HTTP.
 */
import { readFileSync } from 'node:fs'
import type { CollectionSlug, Payload, TypedUser } from 'payload'

import type { SyncCollection, SyncRecord } from './read'

export type Existing = Map<string, { id: number | string; sha?: string }>
export type ReceiptData = Record<string, unknown>

export interface CmsClient {
  tenantId(slug: string): Promise<number | string>
  existing(collection: SyncCollection, tenant: number | string): Promise<Existing>
  create(collection: SyncCollection, data: Record<string, unknown>, file?: SyncRecord['file']): Promise<void>
  update(collection: SyncCollection, id: number | string, data: Record<string, unknown>, file?: SyncRecord['file']): Promise<void>
  lastRevision(tenant: number | string): Promise<number>
  createReceipt(data: ReceiptData): Promise<void>
  receipt(tenant: number | string, receiptId: string): Promise<ReceiptData | undefined>
}

type Doc = { id: number | string; recordId?: string; sync?: { sourceSha256?: string }; revision?: number }

const toExisting = (docs: Doc[]): Existing =>
  new Map(docs.filter((d) => d.recordId).map((d) => [String(d.recordId), { id: d.id, sha: d.sync?.sourceSha256 ?? undefined }]))

export class LocalClient implements CmsClient {
  constructor(
    private payload: Payload,
    private user: TypedUser,
  ) {}
  private get opts() {
    return { overrideAccess: false as const, user: this.user }
  }
  async tenantId(slug: string) {
    const { docs } = await this.payload.find({ collection: 'tenants', ...this.opts, where: { slug: { equals: slug } }, limit: 1 })
    if (!docs[0]) throw new Error(`tenant "${slug}" not found or not assigned to this sync account`)
    return docs[0].id
  }
  async existing(collection: SyncCollection, tenant: number | string) {
    const { docs } = await this.payload.find({
      collection: collection as CollectionSlug, ...this.opts, depth: 0, pagination: false, where: { tenant: { equals: tenant } },
    })
    return toExisting(docs as unknown as Doc[])
  }
  private file(file?: SyncRecord['file']) {
    if (!file) return {}
    const data = readFileSync(file.absolutePath)
    return { file: { data, mimetype: file.mimetype, name: file.name, size: data.length } }
  }
  async create(collection: SyncCollection, data: Record<string, unknown>, file?: SyncRecord['file']) {
    await this.payload.create({ collection: collection as CollectionSlug, ...this.opts, data: data as never, ...this.file(file) })
  }
  async update(collection: SyncCollection, id: number | string, data: Record<string, unknown>, file?: SyncRecord['file']) {
    await this.payload.update({ collection: collection as CollectionSlug, id, ...this.opts, data: data as never, ...this.file(file) })
  }
  async lastRevision(tenant: number | string) {
    const { docs } = await this.payload.find({
      collection: 'sync-receipts', ...this.opts, where: { tenant: { equals: tenant } }, sort: '-revision', limit: 1, depth: 0,
    })
    return Number((docs[0] as unknown as Doc | undefined)?.revision ?? 0)
  }
  async createReceipt(data: ReceiptData) {
    await this.payload.create({ collection: 'sync-receipts', ...this.opts, data: data as never })
  }
  async receipt(tenant: number | string, receiptId: string) {
    const { docs } = await this.payload.find({
      collection: 'sync-receipts', ...this.opts, depth: 0, limit: 1,
      where: { and: [{ tenant: { equals: tenant } }, { receiptId: { equals: receiptId } }] },
    })
    return docs[0] as unknown as ReceiptData | undefined
  }
}

export class RestClient implements CmsClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}
  private async call(method: string, path: string, body?: BodyInit, json = true) {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/cms-api${path}`, {
      method,
      headers: { Authorization: `users API-Key ${this.apiKey}`, ...(json && body ? { 'Content-Type': 'application/json' } : {}) },
      body,
    })
    const text = await res.text()
    const parsed = text ? JSON.parse(text) : {}
    if (!res.ok) {
      const errors = (parsed.errors ?? []) as { message?: string; data?: { errors?: { path?: string; message?: string }[] } }[]
      const detail = errors.flatMap((e) => [e.message, ...(e.data?.errors ?? []).map((x) => `${x.path}: ${x.message}`)]).filter(Boolean)
      throw new Error(`${method} ${path} → ${res.status}: ${detail.join('; ') || text.slice(0, 300)}`)
    }
    return parsed
  }
  private body(data: Record<string, unknown>, file?: SyncRecord['file']): [BodyInit, boolean] {
    if (!file) return [JSON.stringify(data), true]
    const form = new FormData()
    form.append('_payload', JSON.stringify(data))
    form.append('file', new Blob([readFileSync(file.absolutePath)], { type: file.mimetype }), file.name)
    return [form, false]
  }
  async tenantId(slug: string) {
    const res = await this.call('GET', `/tenants?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=0`)
    if (!res.docs?.[0]) throw new Error(`tenant "${slug}" not found or not assigned to this sync account`)
    return res.docs[0].id
  }
  async existing(collection: SyncCollection, tenant: number | string) {
    const docs: Doc[] = []
    for (let page = 1; ; page++) {
      const res = await this.call('GET', `/${collection}?where[tenant][equals]=${tenant}&limit=100&page=${page}&depth=0`)
      docs.push(...res.docs)
      if (!res.hasNextPage) break
    }
    return toExisting(docs)
  }
  async create(collection: SyncCollection, data: Record<string, unknown>, file?: SyncRecord['file']) {
    const [body, json] = this.body(data, file)
    await this.call('POST', `/${collection}`, body, json)
  }
  async update(collection: SyncCollection, id: number | string, data: Record<string, unknown>, file?: SyncRecord['file']) {
    const [body, json] = this.body(data, file)
    await this.call('PATCH', `/${collection}/${id}`, body, json)
  }
  async lastRevision(tenant: number | string) {
    const res = await this.call('GET', `/sync-receipts?where[tenant][equals]=${tenant}&sort=-revision&limit=1&depth=0`)
    return Number(res.docs?.[0]?.revision ?? 0)
  }
  async createReceipt(data: ReceiptData) {
    await this.call('POST', '/sync-receipts', JSON.stringify(data))
  }
  async receipt(tenant: number | string, receiptId: string) {
    const res = await this.call('GET', `/sync-receipts?where[tenant][equals]=${tenant}&where[receiptId][equals]=${encodeURIComponent(receiptId)}&limit=1&depth=0`)
    return res.docs?.[0] as ReceiptData | undefined
  }
}
