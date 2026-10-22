'use client'

import { Eye, EyeOff, FileText, Image as ImageIcon, LoaderCircle, Newspaper, Quote, ReceiptText, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Logo } from './shell/Logo'
import { cn, fieldClass } from './ui'

/**
 * The control room's sign-in, in AyraAgent's sign-in layout: one bordered split card on the
 * app background. Left, what the CMS is; right, the form. It signs in through Payload's own
 * login, so every account rule applies (website and sync accounts refused, repeated failures lock).
 */
const PARTS = [
  { label: 'Pages', icon: FileText },
  { label: 'Posts', icon: Newspaper },
  { label: 'Claims', icon: Quote },
  { label: 'Assets', icon: ImageIcon },
  { label: 'Receipts', icon: ReceiptText },
  { label: 'Checks', icon: ShieldCheck },
]

/** The CMS's parts around the Ayra mark (static; no site names on a public page). */
function Hub() {
  const r = 132
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]" aria-hidden>
      <svg viewBox="-170 -170 340 340" className="absolute inset-0 size-full text-accent/40">
        <circle r={r} fill="none" stroke="currentColor" strokeDasharray="3 6" />
        <circle r={r * 0.62} fill="none" stroke="currentColor" strokeDasharray="3 6" />
        {PARTS.map((_, i) => {
          const a = (i / PARTS.length) * Math.PI * 2 - Math.PI / 2
          return <line key={i} x1={0} y1={0} x2={Math.cos(a) * r} y2={Math.sin(a) * r} stroke="currentColor" strokeWidth={0.75} />
        })}
      </svg>
      {PARTS.map(({ label, icon: Icon }, i) => {
        const a = (i / PARTS.length) * Math.PI * 2 - Math.PI / 2
        return (
          <div
            key={label}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
            style={{ left: `${50 + (Math.cos(a) * r * 100) / 340}%`, top: `${50 + (Math.sin(a) * r * 100) / 340}%` }}
          >
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-accent-fill text-accent-fg">
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </span>
            <span className="text-[11.5px] text-muted">{label}</span>
          </div>
        )
      })}
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
        <span className="flex size-14 items-center justify-center rounded-[14px] bg-accent-fill p-2.5">
          <img src="/brand/ayraagent-mark-dark.svg" alt="" className="size-full" />
        </span>
        <span className="text-[10.5px] font-semibold tracking-[0.12em] text-muted uppercase">Ayra CMS</span>
      </div>
    </div>
  )
}

const GOOGLE_PROBLEMS: Record<string, string> = {
  'google-not-invited': 'That Google account isn’t invited. Use your @neurocare.ai account, or ask an admin to add you.',
  'google-unverified': 'Google says that email address isn’t verified.',
  'google-role': 'That account signs in with an API key, not with Google.',
  'google-denied': 'Google sign-in was cancelled.',
  'google-failed': 'Google sign-in didn’t finish. Try again.',
  'google-not-configured': 'Google sign-in isn’t set up yet.',
  'google-origin': 'Google sign-in can’t be used from this address.',
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export function SignIn({ next, google = false, problem }: { next: string; google?: boolean; problem?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(problem ? GOOGLE_PROBLEMS[problem] ?? null : null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/cms-api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (res.ok) {
        window.location.assign(next) // a full load, so the server sees the new session
        return
      }
      const body = (await res.json().catch(() => ({}))) as { errors?: { message?: string }[] }
      setError(res.status === 401 ? 'That email and password don’t match an account.' : body.errors?.[0]?.message ?? 'Sign-in failed. Try again in a moment.')
    } catch {
      setError('Can’t reach the CMS. Check your connection and try again.')
    }
    setBusy(false)
  }

  return (
    <main id="main" className="relative isolate flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_45%,rgb(61_125_255/0.14),transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_50%_50%,transparent_15%,var(--bg)_100%)]" />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-[24px] border border-border bg-surface/70 backdrop-blur-sm lg:grid-cols-[1.25fr_1fr]">
        <aside className="hidden flex-col gap-8 border-r border-border bg-gradient-to-br from-accent/[0.06] to-transparent p-10 lg:flex">
          <div>
            <p className="border-l-2 border-accent pl-2 text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">Ayra CMS</p>
            <h1 className="pt-3 text-[2.1rem] leading-[1.1] font-semibold tracking-[-0.03em]">
              Every site’s content,
              <br />
              in one control room
            </h1>
          </div>
          <Hub />
        </aside>

        <section className="flex flex-col bg-gradient-to-b from-transparent to-accent/[0.04] p-8 sm:p-10">
          <div>
            <Logo compact />
            <p className="mt-1.5 text-[11px] text-muted">Trouble signing in? Ask an admin.</p>
          </div>

          <div className="my-auto pt-10">
            <h2 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]">Sign in to Ayra CMS</h2>
            <p className="pt-1.5 text-[14px] leading-relaxed text-muted">One account for every site’s content, receipts and checks.</p>

            {google && (
              <>
                <a
                  href={`/auth/google?redirect=${encodeURIComponent(next)}`}
                  className="mt-7 flex h-11 w-full items-center justify-center gap-2.5 rounded-[6px] border border-border-strong bg-surface text-[14px] font-medium transition-colors hover:bg-surface-2"
                >
                  <GoogleMark /> Continue with Google
                </a>
                <div className="mt-5 flex items-center gap-3 text-[11.5px] text-faint" aria-hidden>
                  <span className="h-px flex-1 bg-border" /> or with a password <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}
            <form onSubmit={submit} className={cn('flex flex-col gap-4', google ? 'mt-5' : 'mt-7')} noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cr-email" className="text-[12px] font-medium">
                  Email
                </label>
                <input
                  id="cr-email" type="email" name="email" autoComplete="username" required autoFocus value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                  className={cn(fieldClass, 'h-11 rounded-[6px] text-[14px]')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cr-password" className="text-[12px] font-medium">
                  Password
                </label>
                <span className="relative">
                  <input
                    id="cr-password" type={show ? 'text' : 'password'} name="password" autoComplete="current-password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} className={cn(fieldClass, 'h-11 w-full rounded-[6px] pr-11 text-[14px]')}
                  />
                  <button
                    type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-text"
                  >
                    {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </span>
              </div>

              {error && (
                <p role="alert" className="rounded-[6px] border border-bad/30 bg-bad-soft px-3 py-2 text-[13px]">
                  {error}
                </p>
              )}

              <button
                type="submit" disabled={busy || !email || !password}
                className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-[6px] bg-accent-fill text-[14px] font-medium text-accent-fg transition-colors hover:bg-accent-fill-hover disabled:opacity-60"
              >
                {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="pt-10 text-[11px] text-muted">Website and sync accounts use API keys, not this page.</p>
        </section>
      </div>
    </main>
  )
}
