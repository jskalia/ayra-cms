'use client'

import { ArrowRight, Eye, EyeOff, Globe, LoaderCircle, ReceiptText, ShieldCheck } from 'lucide-react'
import { useRef, useState, type CSSProperties, type FormEvent, type PointerEvent } from 'react'

import { Logo } from './shell/Logo'
import { cn, fieldClass } from './ui'

/**
 * The sign-in screen, in the AyraAgent look: an aurora backdrop, a card whose glow follows the
 * pointer, and a shimmering heading (our own takes on those React Bits effects; the repo is
 * public, so React Bits code itself is not used). It signs in through Payload's own login, so
 * every account rule applies (website and sync accounts are refused; repeated failures lock).
 */
export function SignIn({ next }: { next: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const card = useRef<HTMLDivElement>(null)

  const glow = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

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
      const message = body.errors?.[0]?.message
      setError(
        res.status === 401
          ? 'That email and password don’t match an account.'
          : message ?? 'Sign-in failed. Try again in a moment.',
      )
    } catch {
      setError('Can’t reach the CMS. Check your connection and try again.')
    }
    setBusy(false)
  }

  return (
    <main id="main" className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      <div className="cr-aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="cr-gridlines" aria-hidden />

      <section className="relative hidden flex-col justify-between p-10 lg:flex" aria-label="About Ayra CMS">
        <Logo />
        <div className="max-w-md">
          <h1 className="cr-shiny text-[40px] leading-[1.1] font-bold tracking-[-0.03em]">The control room for every site’s content.</h1>
          <p className="mt-4 text-[15px] text-muted">What each site holds, where it came from, and what needs attention, all read-only and receipted.</p>
          <ul className="mt-8 flex flex-col gap-3 text-[14px]">
            {[
              { icon: Globe, text: 'Every site in one place, each sealed off from the others' },
              { icon: ReceiptText, text: 'A receipt for every change that arrives' },
              { icon: ShieldCheck, text: 'Websites only ever see approved, public content' },
            ].map(({ icon: Icon, text }, i) => (
              <li key={text} className="cr-rise flex items-center gap-3" style={{ '--i': i + 2 } as CSSProperties}>
                <span className="flex size-8 items-center justify-center rounded-[9px] border border-border bg-surface/70 text-accent backdrop-blur">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] text-faint">Ayra CMS · AyraAgent</p>
      </section>

      <section className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        <div ref={card} onPointerMove={glow} className="cr-spotlight cr-rise w-full max-w-[400px] rounded-[20px] border border-border bg-surface/80 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <h2 className="mt-6 text-[22px] font-bold tracking-[-0.02em] lg:mt-0">Sign in</h2>
          <p className="mt-1 text-[13.5px] text-muted">Use your Ayra CMS account.</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
            <label htmlFor="cr-email" className="-mb-2.5 text-[12.5px] font-semibold text-muted">
              Email
            </label>
            <input
                id="cr-email" type="email" name="email" autoComplete="username" required autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)} className={cn(fieldClass, 'h-11 text-[14px]')} placeholder="you@company.com"
              />
            <label htmlFor="cr-password" className="-mb-2.5 text-[12.5px] font-semibold text-muted">
              Password
            </label>
            <span className="relative">
                <input
                  id="cr-password" type={show ? 'text' : 'password'} name="password" autoComplete="current-password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} className={cn(fieldClass, 'h-11 w-full pr-11 text-[14px]')}
                />
                <button
                  type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:bg-surface-2 hover:text-text"
                >
                  {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
            </span>

            {error && (
              <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad-soft px-3 py-2 text-[13px] text-text">
                {error}
              </p>
            )}

            <button
              type="submit" disabled={busy || !email || !password}
              className="cr-button-sheen mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-[11px] bg-accent-fill text-[14px] font-semibold text-accent-fg transition-colors hover:bg-accent-fill-hover disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-[12px] leading-relaxed text-faint">
            Forgot your password? An admin can set a new one. Website and sync accounts use API keys, not this page.
          </p>
        </div>
      </section>
    </main>
  )
}
