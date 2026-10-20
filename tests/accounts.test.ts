/** Accounts: roles, API keys, password sign-in, and the one-time admin bootstrap. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { asUser, ctx, setup, teardown } from './setup'

beforeAll(setup, 180_000)
afterAll(teardown)

describe('roles and sign-in', () => {
  it('a viewer cannot promote themselves or add sites', async () => {
    await ctx.payload
      .update({
        collection: 'users', id: ctx.users.viewerA.id, ...asUser('viewerA'),
        data: { role: 'admin', tenants: [{ tenant: ctx.tenantA }, { tenant: ctx.tenantB }] } as never,
      })
      .catch(() => undefined)
    const me = await ctx.payload.findByID({ collection: 'users', id: ctx.users.viewerA.id, depth: 0 })
    expect(me.role).toBe('editor')
    expect((me.tenants ?? []).map((t) => (typeof t.tenant === 'object' ? t.tenant.id : t.tenant))).toEqual([ctx.tenantA])
  })
  it('website and sync accounts cannot sign in with a password', async () => {
    for (const who of ['readera', 'synca']) {
      await expect(ctx.payload.login({ collection: 'users', data: { email: `${who}@example.test`, password: 'test-only-password' } })).rejects.toThrow()
    }
    const ok = await ctx.payload.login({ collection: 'users', data: { email: 'viewera@example.test', password: 'test-only-password' } })
    expect(ok.user?.email).toBe('viewera@example.test')
  })
  it('only an admin manages API keys; API accounts cannot edit themselves', async () => {
    await expect(ctx.payload.update({ collection: 'users', id: ctx.users.viewerA.id, ...asUser('viewerA'), data: { enableAPIKey: true } as never })).rejects.toThrow()
    await expect(ctx.payload.update({ collection: 'users', id: ctx.users.readerA.id, ...asUser('readerA'), data: { name: 'renamed' } as never })).rejects.toThrow()
    const self = await ctx.payload.update({ collection: 'users', id: ctx.users.viewerA.id, ...asUser('viewerA'), data: { name: 'Viewer A' } as never })
    expect(self.name).toBe('Viewer A')
  })
})

describe('one-time admin bootstrap', () => {
  it('does nothing unless both variables are set, and refuses a short password', async () => {
    const { bootstrapAdmin } = await import('../src/lib/bootstrapAdmin')
    expect(await bootstrapAdmin(ctx.payload, {})).toBe('not-configured')
    expect(await bootstrapAdmin(ctx.payload, { email: 'boot@example.test' })).toBe('not-configured')
    expect(await bootstrapAdmin(ctx.payload, { email: 'boot@example.test', password: 'short' })).toBe('too-short')
  })
  it('creates one admin who can sign in, once', async () => {
    const { bootstrapAdmin } = await import('../src/lib/bootstrapAdmin')
    const creds = { email: 'Boot@Example.test', password: 'a-long-test-password' }
    expect(await bootstrapAdmin(ctx.payload, creds)).toBe('created')
    expect(await bootstrapAdmin(ctx.payload, creds)).toBe('exists')
    const login = await ctx.payload.login({ collection: 'users', data: { email: 'boot@example.test', password: creds.password } })
    expect(login.user?.role).toBe('admin')
  })
  it('never changes an existing account (no takeover)', async () => {
    const { bootstrapAdmin } = await import('../src/lib/bootstrapAdmin')
    expect(await bootstrapAdmin(ctx.payload, { email: 'viewera@example.test', password: 'attacker-password-123' })).toBe('exists')
    await expect(ctx.payload.login({ collection: 'users', data: { email: 'viewera@example.test', password: 'attacker-password-123' } })).rejects.toThrow()
  })
})

describe('password resets never leak a link (2.9)', () => {
  const resetToken = async (id: number | string) =>
    ((await ctx.payload.findByID({ collection: 'users', id, showHiddenFields: true })) as { resetPasswordToken?: string | null }).resetPasswordToken
  it('without email, "Forgot password?" is refused and no reset token is made', async () => {
    const logged: string[] = []
    const { logger } = ctx.payload
    const spy = (level: 'info' | 'warn' | 'error') => {
      const original = logger[level].bind(logger)
      logger[level] = ((...a: unknown[]) => (logged.push(JSON.stringify(a)), original(...(a as [never])))) as never
      return () => (logger[level] = original as never)
    }
    const restore = [spy('info'), spy('warn'), spy('error')]
    try {
      await expect(
        ctx.payload.forgotPassword({ collection: 'users', data: { email: 'viewera@example.test' } }),
      ).rejects.toThrow(/off until the CMS has email/)
    } finally {
      restore.forEach((r) => r())
    }
    expect(await resetToken(ctx.users.viewerA.id)).toBeFalsy()
    expect(logged.join('\n')).not.toMatch(/reset/i)
  })
  it('with email configured, resets are allowed (here without sending anything)', async () => {
    process.env.RESEND_API_KEY = 're_test_not_a_real_key'
    process.env.EMAIL_FROM = 'cms@example.test'
    try {
      const token = await ctx.payload.forgotPassword({ collection: 'users', data: { email: 'viewera@example.test' }, disableEmail: true })
      expect(token).toBeTruthy()
      expect(await resetToken(ctx.users.viewerA.id)).toBeTruthy()
    } finally {
      delete process.env.RESEND_API_KEY
      delete process.env.EMAIL_FROM
    }
  })
  it('the config uses Resend only when both settings are present, never the logging adapter', async () => {
    const { emailAdapter } = await import('../src/lib/email')
    expect(emailAdapter()).toBeUndefined()
    process.env.RESEND_API_KEY = 're_test_not_a_real_key'
    expect(emailAdapter()).toBeUndefined()
    process.env.EMAIL_FROM = 'cms@example.test'
    try {
      expect(emailAdapter()).toBeTypeOf('function')
    } finally {
      delete process.env.RESEND_API_KEY
      delete process.env.EMAIL_FROM
    }
  })
})
