'use client'

import Link from 'next/link'
import { memo, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  GitBranch,
  Github,
  Lock,
  Radar,
  Shield,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */
const C = {
  bg: 'var(--bg-primary)',
  surface: 'var(--bg-secondary)',
  surfaceStrong: 'var(--bg-tertiary)',
  border: 'var(--border-color)',
  text: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  green: '#22c55e',
  amber: '#f59e0b',
  rose: '#f43f5e',
}
const GRADIENT = 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)'
const GRADIENT_TEXT = 'linear-gradient(120deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)'

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry], obs) => {
        if (entry.isIntersecting) {
          setShown(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, shown }
}

function useMagnetic<T extends HTMLElement>(strength = 0.25) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    let raf = 0
    let pending: { x: number; y: number } | null = null
    const apply = () => {
      raf = 0
      if (!pending) return
      el.style.transform = `translate3d(${pending.x}px, ${pending.y}px, 0)`
    }
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      pending = {
        x: (e.clientX - rect.left - rect.width / 2) * strength,
        y: (e.clientY - rect.top - rect.height / 2) * strength,
      }
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      pending = null
      el.style.transform = 'translate3d(0,0,0)'
    }
    el.addEventListener('mousemove', onMove, { passive: true })
    el.addEventListener('mouseleave', onLeave, { passive: true })
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [strength])
  return ref
}

// Pause-when-offscreen + tab-hidden visibility hook for animation loops.
function useIsVisible<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    )
    io.observe(el)
    const onVis = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  return { ref, visible }
}

/* ------------------------------------------------------------------ */
/*  Reveal wrapper                                                     */
/* ------------------------------------------------------------------ */
function Reveal({
  children,
  delay = 0,
  y = 28,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
        transition: `opacity 700ms cubic-bezier(.2,.7,.2,1) ${delay}ms, transform 800ms cubic-bezier(.2,.7,.2,1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */
function GradientText({
  children,
  className = '',
  bg = GRADIENT_TEXT,
}: {
  children: React.ReactNode
  className?: string
  bg?: string
}) {
  return (
    <span
      className={className}
      style={{
        background: bg,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {children}
    </span>
  )
}

function PrimaryButton({
  children,
  href,
  className = '',
  trailing,
}: {
  children: React.ReactNode
  href: string
  className?: string
  trailing?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5 ${className}`}
      style={{
        background: GRADIENT,
        boxShadow:
          '0 12px 32px -10px rgba(59,130,246,0.55), 0 4px 12px -4px rgba(167,139,250,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <span className="relative z-10">{children}</span>
      {trailing ?? (
        <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      )}
    </Link>
  )
}

function GhostButton({
  children,
  href,
  className = '',
  leading,
}: {
  children: React.ReactNode
  href: string
  className?: string
  leading?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 ${className}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.12)',
        color: C.text,
        backdropFilter: 'blur(12px)',
      }}
    >
      {leading}
      {children}
      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
    </Link>
  )
}

function Eyebrow({ children, dot = true }: { children: React.ReactNode; dot?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
      style={{
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.22)',
        color: '#93c5fd',
      }}
    >
      {dot && <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
      </span>}
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Nav                                                                */
/* ------------------------------------------------------------------ */
const Nav = memo(function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    let raf = 0
    let last = false
    const apply = () => {
      raf = 0
      const next = window.scrollY > 12
      if (next !== last) {
        last = next
        setScrolled(next)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(10,12,18,0.65)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
      }}
    >
      <nav className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-4 xl:px-12">
        <Link href="/" className="group flex items-center gap-3">
          <div
            className="relative flex h-10 w-10 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:rotate-[10deg]"
            style={{ background: GRADIENT, boxShadow: '0 8px 22px -6px rgba(59,130,246,0.6)' }}
          >
            <Shield className="h-5 w-5 text-white" strokeWidth={2.6} />
          </div>
          <div className="leading-tight">
            <span className="block text-[17px] font-bold tracking-tight" style={{ color: C.text }}>
              VaultSentry
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: C.textMuted }}>
              Secret Intelligence
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-1 rounded-full border px-1.5 py-1.5 md:flex"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          {[
            ['Product', '#features'],
            ['Workflow', '#how'],
            ['Pricing', '#pricing'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors"
              style={{ color: C.textSecondary }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = C.text
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = C.textSecondary
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-[13px] font-semibold transition-colors sm:inline-flex"
            style={{ color: C.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
          >
            Sign in
          </Link>
          <PrimaryButton href="/register" className="!px-4 !py-2 !text-[13px]">
            Start free
          </PrimaryButton>
        </div>
      </nav>
    </header>
  )
})

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(120,120,140,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(120,120,140,0.35) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 80%)',
        }}
      />
      {/* aurora blobs */}
      <div
        className="absolute -top-32 left-[5%] h-[460px] w-[680px] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(closest-side, rgba(59,130,246,0.45), transparent)' }}
      />
      <div
        className="absolute top-[10%] right-[-8%] h-[520px] w-[640px] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(closest-side, rgba(167,139,250,0.35), transparent)' }}
      />
      <div
        className="absolute bottom-[-20%] left-[35%] h-[400px] w-[560px] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(closest-side, rgba(244,114,182,0.18), transparent)' }}
      />
      {/* noise */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-32 sm:pb-32 sm:pt-36">
      <HeroBackdrop />

      <div className="relative mx-auto w-full max-w-[1600px] px-6 xl:px-12">
        <div className="grid items-center gap-14 lg:grid-cols-12">
          {/* LEFT — copy */}
          <div className="lg:col-span-7">
            <Reveal>
              <Eyebrow>v2.0 · Now in early access</Eyebrow>
            </Reveal>

            <Reveal delay={80}>
              <h1
                className="mt-6 text-[44px] font-bold leading-[1.02] tracking-tight sm:text-6xl md:text-[76px]"
                style={{ color: C.text, letterSpacing: '-0.035em' }}
              >
                Stop your{' '}
                <span className="relative inline-block">
                  <GradientText>secrets</GradientText>
                  <svg
                    aria-hidden
                    className="absolute -bottom-2 left-0 w-full"
                    height="14"
                    viewBox="0 0 300 14"
                    fill="none"
                  >
                    <path
                      d="M2 9 Q 75 -2, 150 6 T 298 5"
                      stroke="url(#u)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <defs>
                      <linearGradient id="u" x1="0" x2="1">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#f472b6" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
                <br />
                from leaving the building.
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed sm:text-xl" style={{ color: C.textMuted }}>
                VaultSentry is the secret-detection layer your repos deserve.{' '}
                <span style={{ color: C.text }}>Catch leaked credentials in seconds</span>, route them to the
                right owner, and prove they&apos;re fixed — all without a config file.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <PrimaryButton href="/register">Get started — it&apos;s free</PrimaryButton>
                <GhostButton href="#how" leading={<Terminal className="h-4 w-4" />}>
                  See it in action
                </GhostButton>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]"
                style={{ color: C.textMuted }}>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4" style={{ color: C.green }} /> SOC 2-aligned
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4" style={{ color: C.green }} /> No credit card
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4" style={{ color: C.green }} /> 4-minute setup
                </span>
              </div>
            </Reveal>
          </div>

          {/* RIGHT — terminal */}
          <div className="lg:col-span-5">
            <Reveal delay={200} y={40}>
              <LiveTerminal />
            </Reveal>
          </div>
        </div>
      </div>

      {/* Marquee */}
      <Reveal delay={400}>
        <SecretMarquee />
      </Reveal>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Live terminal (asymmetric hero element)                            */
/* ------------------------------------------------------------------ */
type TerminalLine = { t: 'scan' | 'hit' | 'meta' | 'ok'; text: string; sev?: string }
const TERMINAL_LINES: ReadonlyArray<TerminalLine> = [
  { t: 'scan', text: 'Scanning vaultsentry/api · main' },
  { t: 'hit', text: 'AWS_ACCESS_KEY_ID  · src/services/s3.ts:42', sev: 'CRITICAL' },
  { t: 'meta', text: '↳ rotated 14s ago · alert sent to @mira' },
  { t: 'hit', text: 'STRIPE_SECRET_KEY  · billing/checkout.ts:18', sev: 'CRITICAL' },
  { t: 'meta', text: '↳ owner: payments-team · webhook fired' },
  { t: 'ok', text: 'Repo clean · 1,284 files scanned in 3.1s' },
]

const SEV_STYLE = {
  CRITICAL: { color: C.rose, bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)' },
  HIGH: { color: C.amber, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
} as const

const LiveTerminal = memo(function LiveTerminal() {
  const { ref, visible } = useIsVisible<HTMLDivElement>()
  const reduced = typeof window !== 'undefined' ? prefersReducedMotion() : false
  const [shown, setShown] = useState(reduced ? TERMINAL_LINES.length : 0)

  useEffect(() => {
    if (reduced) return
    if (!visible) return
    if (shown < TERMINAL_LINES.length) {
      const ms = TERMINAL_LINES[shown].t === 'meta' ? 380 : 700
      const id = setTimeout(() => setShown((n) => n + 1), ms)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setShown(0), 4200)
    return () => clearTimeout(id)
  }, [shown, visible, reduced])

  const lines = TERMINAL_LINES
  const sevStyle = (s?: string) =>
    (s && (SEV_STYLE as any)[s]) || SEV_STYLE.HIGH

  return (
    <div
      ref={ref}
      className="relative rounded-3xl p-2 transition-transform duration-700 hover:rotate-0"
      style={{
        background: 'linear-gradient(180deg, rgba(96,165,250,0.5), rgba(167,139,250,0.25) 40%, rgba(244,114,182,0.15))',
        transform: 'rotate(1.2deg)',
        boxShadow: '0 40px 80px -30px rgba(0,0,0,0.6), 0 20px 40px -20px rgba(96,165,250,0.35)',
      }}
    >
      <div
        className="overflow-hidden rounded-[20px]"
        style={{
          background: 'linear-gradient(180deg, #0d1018, #0a0c12)',
          border: `1px solid ${C.border}`,
        }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: C.border }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#28c840' }} />
          <span className="ml-3 inline-flex items-center gap-1.5 font-mono text-[11px]" style={{ color: C.textMuted }}>
            <Terminal className="h-3 w-3" />
            ~/vaultsentry · live feed
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(34,197,94,0.12)', color: C.green, border: '1px solid rgba(34,197,94,0.25)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            STREAMING
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-5 font-mono text-[12.5px] leading-[1.85]" style={{ minHeight: 320 }}>
          {lines.slice(0, shown).map((l, i) => {
            if (l.t === 'scan') {
              return (
                <div key={i} className="flex items-center gap-2" style={{ color: C.textSecondary }}>
                  <span style={{ color: '#60a5fa' }}>$</span>
                  <span>vaultsentry scan --realtime</span>
                </div>
              )
            }
            if (l.t === 'hit') {
              const s = sevStyle(l.sev)
              return (
                <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                  >
                    {l.sev}
                  </span>
                  <span style={{ color: C.text }}>{l.text}</span>
                </div>
              )
            }
            if (l.t === 'meta') {
              return (
                <div key={i} className="ml-1" style={{ color: C.textMuted }}>
                  {l.text}
                </div>
              )
            }
            return (
              <div key={i} className="mt-3 flex items-center gap-2" style={{ color: C.green }}>
                <Check className="h-3.5 w-3.5" /> {l.text}
              </div>
            )
          })}
          <span
            className="ml-1 inline-block h-3.5 w-1.5 align-middle"
            style={{ background: '#60a5fa', animation: 'vs-blink 1s steps(2) infinite' }}
          />
        </div>
      </div>

    </div>
  )
})

/* ------------------------------------------------------------------ */
/*  Marquee                                                            */
/* ------------------------------------------------------------------ */
const MARQUEE_ITEMS = [
  'AWS_ACCESS_KEY', 'STRIPE_SECRET', 'GITHUB_PAT', 'OPENAI_API_KEY',
  'GCP_SERVICE_ACCOUNT', 'TWILIO_AUTH_TOKEN', 'JWT_PRIVATE_KEY', 'DATABASE_URL',
  'SLACK_WEBHOOK', 'SENDGRID_KEY', 'AZURE_CLIENT_SECRET', 'NPM_TOKEN', 'DOCKER_PASSWORD',
]
const MARQUEE_ROW = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]

const SecretMarquee = memo(function SecretMarquee() {
  const { ref, visible } = useIsVisible<HTMLDivElement>()
  const row = MARQUEE_ROW
  return (
    <div ref={ref} className="relative mt-24 select-none">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32"
        style={{ background: `linear-gradient(90deg, ${C.bg}, transparent)` }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32"
        style={{ background: `linear-gradient(270deg, ${C.bg}, transparent)` }} />
      <div
        className="flex gap-4 whitespace-nowrap will-change-transform"
        style={{
          animation: 'vs-marquee 38s linear infinite',
          animationPlayState: visible ? 'running' : 'paused',
        }}
      >
        {row.map((s, i) => (
          <div
            key={i}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
              color: C.textSecondary,
            }}
          >
            <Lock className="h-3 w-3" style={{ color: C.accentHover }} />
            {s}
          </div>
        ))}
      </div>
    </div>
  )
})

/* ------------------------------------------------------------------ */
/*  Integration brand logos (inline SVG so no extra deps)              */
/* ------------------------------------------------------------------ */
const INTEGRATION_LOGOS: Array<{ name: string; logo: React.ReactNode }> = [
  {
    name: 'GitHub',
    logo: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#f3f4f6" aria-hidden>
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a10.96 10.96 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.77 1.07.77 2.16v3.2c0 .31.21.67.8.55A10.5 10.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    ),
  },
  {
    name: 'GitLab',
    logo: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
        <path fill="#FC6D26" d="m23.6 9.6-.03-.08L20.7.92a.74.74 0 0 0-1.42.05l-1.94 5.94H6.66L4.72.97A.74.74 0 0 0 3.3.92L.43 9.52.4 9.6a5.27 5.27 0 0 0 1.75 6.1l.01.01.03.02 4.32 3.24 2.14 1.62 1.3.99a.87.87 0 0 0 1.06 0l1.3-.99 2.14-1.62 4.35-3.26.01-.01A5.27 5.27 0 0 0 23.6 9.6Z" />
        <path fill="#E24329" d="m12 21.58 2.14-6.6H9.86L12 21.58z" />
        <path fill="#FC6D26" d="m12 21.58-2.14-6.6H6.86L12 21.58z" />
        <path fill="#FCA326" d="m6.86 14.98-.66 2.03a.45.45 0 0 0 .16.5l5.64 4.07-5.14-6.6Z" />
        <path fill="#E24329" d="M6.86 14.98h3l-1.3-3.97-1.7 3.97Z" />
        <path fill="#FC6D26" d="m12 21.58 2.14-6.6h3l-5.14 6.6Z" />
        <path fill="#FCA326" d="m17.14 14.98.66 2.03a.45.45 0 0 1-.16.5L12 21.58l5.14-6.6Z" />
        <path fill="#E24329" d="M17.14 14.98h-3l1.3-3.97 1.7 3.97Z" />
      </svg>
    ),
  },
  {
    name: 'Slack',
    logo: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path fill="#E01E5A" d="M5.04 15.16a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52Zm1.27 0a2.52 2.52 0 0 1 5.04 0v6.32a2.52 2.52 0 0 1-5.04 0v-6.32Z" />
        <path fill="#36C5F0" d="M8.83 5.04a2.52 2.52 0 1 1 2.52-2.52v2.52H8.83Zm0 1.28a2.52 2.52 0 0 1 0 5.04H2.52a2.52 2.52 0 0 1 0-5.04h6.31Z" />
        <path fill="#2EB67D" d="M18.96 8.83a2.52 2.52 0 1 1 2.52 2.52h-2.52V8.83Zm-1.28 0a2.52 2.52 0 0 1-5.04 0V2.52a2.52 2.52 0 0 1 5.04 0v6.31Z" />
        <path fill="#ECB22E" d="M15.16 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52Zm0-1.28a2.52 2.52 0 0 1 0-5.04h6.32a2.52 2.52 0 0 1 0 5.04h-6.32Z" />
      </svg>
    ),
  },
  {
    name: 'Jira',
    logo: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <defs>
          <linearGradient id="vs-jira-a" x1="22" x2="12" y1="12" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0052CC" />
            <stop offset="1" stopColor="#2684FF" />
          </linearGradient>
          <linearGradient id="vs-jira-b" x1="2" x2="12" y1="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0052CC" />
            <stop offset="1" stopColor="#2684FF" />
          </linearGradient>
        </defs>
        <path fill="#2684FF" d="M22.84 11.42 12.58 1.16 11.58.16l-7.7 7.7 3.55 3.56L11.58 7.27l8.26 8.27 3-4.12Z" />
        <path fill="url(#vs-jira-a)" d="M11.58 7.27a6.48 6.48 0 0 1 .03-9.13l-7.7 7.7 4.62 4.62 3.05-3.19Z" />
        <path fill="url(#vs-jira-b)" d="M15.55 11.43 11.58 15.4a6.48 6.48 0 0 1 0 9.16l7.7-7.7-3.73-5.43Z" />
        <path fill="#2684FF" d="m11.58 15.4-3.55 3.56L1.16 12.13l7.7-7.7L11.58 7.27Z" />
      </svg>
    ),
  },
  {
    name: 'Linear',
    logo: (
      <svg viewBox="0 0 100 100" width="22" height="22" aria-hidden>
        <defs>
          <linearGradient id="vs-linear-a" x1="0" x2="100" y1="0" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#5e6ad2" />
          </linearGradient>
        </defs>
        <path fill="url(#vs-linear-a)" d="M1.22 61.84A50 50 0 0 0 38.16 98.78L1.22 61.84Zm-1.2-11.62 50 49.78a50 50 0 0 0 11-1.22L1.24 39.22a50 50 0 0 0-1.22 11Zm4.04-19.05 65.98 65.98a50 50 0 0 0 8.13-4.62L8.6 23.04a50 50 0 0 0-4.54 8.13Zm9.95-13.71a50 50 0 1 1 70.7 70.7L13.99 17.46Z" />
      </svg>
    ),
  },
]

/* ------------------------------------------------------------------ */
/*  Bento Features                                                     */
/* ------------------------------------------------------------------ */
function Features() {
  return (
    <section id="features" className="relative py-28 sm:py-36">
      <div className="mx-auto w-full max-w-[1600px] px-6 xl:px-12">
        <Reveal>
          <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <Eyebrow>What&apos;s inside</Eyebrow>
              <h2
                className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
                style={{ color: C.text, letterSpacing: '-0.025em' }}
              >
                A toolkit shaped by{' '}
                <GradientText>real incident reports.</GradientText>
              </h2>
            </div>
            <p className="max-w-md text-base sm:text-lg" style={{ color: C.textMuted }}>
              We built each piece by reading post-mortems — not feature checklists. Every component below
              has saved someone an awful Tuesday.
            </p>
          </div>
        </Reveal>

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
          {/* Big tile — detection */}
          <Reveal className="md:col-span-4 md:row-span-2">
            <BentoCard size="lg">
              <div className="relative flex h-full flex-col">
                <div className="flex items-center gap-2">
                  <Pill icon={<Radar className="h-3 w-3" />}>Real-time detection</Pill>
                </div>
                <h3 className="mt-5 text-2xl font-semibold sm:text-3xl" style={{ color: C.text }}>
                  Catches the leak{' '}
                  <GradientText>before the commit lands.</GradientText>
                </h3>
                <p className="mt-3 max-w-md text-sm sm:text-base" style={{ color: C.textMuted }}>
                  147 entropy + pattern detectors, hand-tuned per provider. False-positive rate stays
                  under 0.4% on the public corpus.
                </p>

                {/* mini chart illustration */}
                <div className="mt-auto pt-8">
                  <DetectionChart />
                </div>
              </div>
            </BentoCard>
          </Reveal>

          {/* Owner routing */}
          <Reveal delay={80} className="md:col-span-2">
            <BentoCard>
              <Pill icon={<Zap className="h-3 w-3" />}>Owner routing</Pill>
              <h3 className="mt-4 text-lg font-semibold" style={{ color: C.text }}>
                The right person, at 3 AM.
              </h3>
              <p className="mt-2 text-sm" style={{ color: C.textMuted }}>
                Findings auto-route by CODEOWNERS, blast radius, and on-call rotation.
              </p>

              <div className="mt-5 flex -space-x-2">
                {['#60a5fa', '#a78bfa', '#f472b6', '#34d399'].map((c, i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2"
                    style={{ background: c, borderColor: C.bg }} />
                ))}
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                  style={{ background: C.surfaceStrong, borderColor: C.bg, color: C.text }}>
                  +12
                </div>
              </div>
            </BentoCard>
          </Reveal>

          {/* Lifecycle */}
          <Reveal delay={120} className="md:col-span-2">
            <BentoCard>
              <Pill icon={<GitBranch className="h-3 w-3" />}>Lifecycle</Pill>
              <h3 className="mt-4 text-lg font-semibold" style={{ color: C.text }}>
                Every secret, fully traced.
              </h3>
              <p className="mt-2 text-sm" style={{ color: C.textMuted }}>
                Detected → notified → rotated → verified. With timestamps.
              </p>
              <div className="mt-5 space-y-2">
                {[
                  { l: 'Detected', c: '#f43f5e', t: '0s' },
                  { l: 'Notified', c: '#f59e0b', t: '12s' },
                  { l: 'Rotated', c: '#60a5fa', t: '4m' },
                  { l: 'Verified', c: '#22c55e', t: '5m' },
                ].map((s) => (
                  <div key={s.l} className="flex items-center gap-3 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.c }} />
                    <span style={{ color: C.text }} className="flex-1">{s.l}</span>
                    <span className="font-mono" style={{ color: C.textMuted }}>{s.t}</span>
                  </div>
                ))}
              </div>
            </BentoCard>
          </Reveal>

          {/* Integrations */}
          <Reveal delay={160} className="md:col-span-3">
            <BentoCard>
              <Pill icon={<Github className="h-3 w-3" />}>Plugs in everywhere</Pill>
              <h3 className="mt-4 text-lg font-semibold" style={{ color: C.text }}>
                Github, Gitlab, Slack, Jira, Linear.
              </h3>
              <p className="mt-2 text-sm" style={{ color: C.textMuted }}>
                Two-way integrations — not just outbound webhooks. Resolve in Slack, sync to Jira, close in Linear.
              </p>
              <div className="mt-5 grid grid-cols-5 gap-2">
                {INTEGRATION_LOGOS.map((it) => (
                  <div
                    key={it.name}
                    title={it.name}
                    className="group/logo flex aspect-square items-center justify-center rounded-xl transition-all duration-300 hover:-translate-y-0.5"
                    style={{
                      background: C.surfaceStrong,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <span className="transition-transform duration-300 group-hover/logo:scale-110">
                      {it.logo}
                    </span>
                  </div>
                ))}
              </div>
            </BentoCard>
          </Reveal>

          {/* Privacy */}
          <Reveal delay={200} className="md:col-span-3">
            <BentoCard>
              <Pill icon={<Lock className="h-3 w-3" />}>Privacy first</Pill>
              <h3 className="mt-4 text-lg font-semibold" style={{ color: C.text }}>
                Your code never leaves your account.
              </h3>
              <p className="mt-2 text-sm" style={{ color: C.textMuted }}>
                Scans run in your tenant. We see hashes, not source. Zero retention on findings you resolve.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {['SOC 2', 'GDPR', 'HIPAA-ready', 'BYOK', 'Self-host'].map((b) => (
                  <span
                    key={b}
                    className="rounded-full border px-3 py-1 text-[11px] font-medium"
                    style={{
                      borderColor: 'rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.03)',
                      color: C.textSecondary,
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </BentoCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

const BentoCard = memo(function BentoCard({
  children,
  size = 'md',
}: {
  children: React.ReactNode
  size?: 'md' | 'lg'
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    let raf = 0
    let pending: { x: number; y: number } | null = null
    const apply = () => {
      raf = 0
      if (!pending) return
      el.style.setProperty('--mx', `${pending.x}px`)
      el.style.setProperty('--my', `${pending.y}px`)
    }
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      pending = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (!raf) raf = requestAnimationFrame(apply)
    }
    el.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      el.removeEventListener('mousemove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`bento-card group relative h-full overflow-hidden rounded-3xl p-6 ${size === 'lg' ? 'sm:p-8' : ''}`}
      style={{
        background: `linear-gradient(180deg, ${C.surface}, rgba(20,22,30,0.8))`,
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(400px circle at var(--mx) var(--my), rgba(96,165,250,0.15), transparent 60%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
})

function Pill({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{
        borderColor: 'rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.03)',
        color: '#93c5fd',
      }}
    >
      {icon}
      {children}
    </span>
  )
}

function DetectionChart() {
  const points = [12, 19, 14, 26, 22, 38, 30, 50, 44, 62, 56, 78, 70, 92]
  const max = 100
  const w = 520
  const h = 130
  const step = w / (points.length - 1)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / max) * h}`).join(' ')
  const area = `${path} L ${w} ${h} L 0 ${h} Z`
  const lastX = (points.length - 1) * step
  const lastY = h - (points[points.length - 1] / max) * h

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h + 16}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bento-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bento-stroke" x1="0" x2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#bento-fill)" />
        <path d={path} stroke="url(#bento-stroke)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx={lastX} cy={lastY} r="5" fill="#f472b6">
          <animate attributeName="r" values="5;9;5" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <circle cx={lastX} cy={lastY} r="3" fill="#fff" />
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  How it works (asymmetric)                                          */
/* ------------------------------------------------------------------ */
function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Connect a repo',
      desc: 'Sign in, paste a Github URL. No SSH keys, no agent installs. We index your tree in under 4 seconds.',
      tag: 'in 4s',
    },
    {
      n: '02',
      title: 'Watch the first scan',
      desc: 'See findings stream in live, severity-ranked, with file + line precision. Triage as they arrive.',
      tag: 'live feed',
    },
    {
      n: '03',
      title: 'Close the loop',
      desc: 'Rotate, resolve, or mark false-positive. We track every state change and prove the leak is gone.',
      tag: 'auditable',
    },
  ]
  return (
    <section id="how" className="relative py-28 sm:py-36">
      <div className="mx-auto w-full max-w-[1600px] px-6 xl:px-12">
        <Reveal>
          <div className="mb-16 max-w-2xl">
            <Eyebrow>The flow</Eyebrow>
            <h2
              className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
              style={{ color: C.text, letterSpacing: '-0.025em' }}
            >
              From <em className="not-italic"><GradientText>signup</GradientText></em> to your{' '}
              <em className="not-italic"><GradientText>first save</GradientText></em>{' '}
              in under five minutes.
            </h2>
          </div>
        </Reveal>

        <div className="relative">
          {/* connecting line */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-[68px] hidden h-px md:block"
            style={{
              background: `linear-gradient(90deg, transparent, ${C.border}, ${C.border}, transparent)`,
            }}
          />

          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div
                  className="group relative h-full overflow-hidden rounded-3xl p-7 transition-all duration-500 hover:-translate-y-2"
                  style={{
                    background: `linear-gradient(180deg, ${C.surface}, rgba(20,22,30,0.6))`,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="relative flex h-14 w-14 items-center justify-center rounded-2xl font-mono text-base font-bold text-white"
                      style={{ background: GRADIENT, boxShadow: '0 12px 24px -10px rgba(96,165,250,0.55)' }}
                    >
                      {s.n}
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                        style={{ boxShadow: '0 0 0 6px rgba(96,165,250,0.2)' }}
                      />
                    </div>
                    <span
                      className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        borderColor: 'rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.03)',
                        color: C.textMuted,
                      }}
                    >
                      {s.tag}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold" style={{ color: C.text }}>
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: C.textMuted }}>
                    {s.desc}
                  </p>

                  <div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                    style={{ background: 'rgba(96,165,250,0.25)' }}
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */
function Pricing() {
  const tiers = [
    {
      name: 'Solo',
      price: 'Free',
      period: 'forever',
      desc: 'For solo developers getting started.',
      features: ['1 repository', '1 scan / week', '7 days history', 'Email alerts'],
      cta: 'Get started',
      href: '/register',
      highlight: false,
    },
    {
      name: 'Team',
      price: '₹299',
      period: 'month',
      desc: 'For growing teams that ship fast.',
      features: [
        '10 repositories',
        '50 scans / week',
        '30 days history',
        'Slack + Jira integrations',
        'ML risk scoring',
        'Scheduled scans',
      ],
      cta: 'Start Team',
      href: '/register?redirect=/pricing',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: '₹999',
      period: 'month',
      desc: 'For security-first organisations.',
      features: [
        'Unlimited repositories',
        'Unlimited scans',
        '365 days history',
        'SSO / SAML + audit logs',
        'Auto secret rotation',
        'Priority 24/7 support',
      ],
      cta: 'Talk to sales',
      href: '/register?redirect=/pricing',
      highlight: false,
    },
  ]
  return (
    <section id="pricing" className="relative py-28 sm:py-36">
      <div className="mx-auto w-full max-w-[1600px] px-6 xl:px-12">
        <Reveal>
          <div className="mb-14 max-w-2xl">
            <Eyebrow>Pricing</Eyebrow>
            <h2
              className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
              style={{ color: C.text, letterSpacing: '-0.025em' }}
            >
              Pay for what you use. <br />
              <GradientText>Not what you might.</GradientText>
            </h2>
          </div>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <div
                className="relative h-full overflow-hidden rounded-3xl p-7 transition-all duration-500 hover:-translate-y-1"
                style={{
                  background: t.highlight
                    ? 'linear-gradient(180deg, rgba(96,165,250,0.14), rgba(167,139,250,0.06))'
                    : `linear-gradient(180deg, ${C.surface}, rgba(20,22,30,0.7))`,
                  border: t.highlight ? '1px solid rgba(96,165,250,0.45)' : `1px solid ${C.border}`,
                  boxShadow: t.highlight ? '0 30px 60px -30px rgba(96,165,250,0.55)' : 'none',
                }}
              >
                {t.highlight && (
                  <div
                    className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white"
                    style={{ background: GRADIENT, boxShadow: '0 8px 20px -8px rgba(96,165,250,0.55)' }}
                  >
                    <Sparkles className="h-3 w-3" /> Most popular
                  </div>
                )}
                <h3 className="text-base font-semibold uppercase tracking-[0.18em]" style={{ color: '#93c5fd' }}>
                  {t.name}
                </h3>
                <p className="mt-2 text-sm" style={{ color: C.textMuted }}>{t.desc}</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight" style={{ color: C.text, letterSpacing: '-0.03em' }}>
                    {t.price}
                  </span>
                  {t.period && (
                    <span className="text-sm" style={{ color: C.textMuted }}>/ {t.period}</span>
                  )}
                </div>
                <div className="my-6 h-px" style={{ background: C.border }} />
                <ul className="space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: C.text }}>
                      <span
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'rgba(34,197,94,0.15)' }}
                      >
                        <Check className="h-3 w-3" style={{ color: C.green }} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  {t.highlight ? (
                    <PrimaryButton href={t.href} className="w-full">{t.cta}</PrimaryButton>
                  ) : (
                    <GhostButton href={t.href} className="w-full">{t.cta}</GhostButton>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: C.textMuted }}>
          All prices in INR · Save ~17% on yearly billing · Cancel anytime
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Final CTA                                                          */
/* ------------------------------------------------------------------ */
function FinalCTA() {
  const magRef = useMagnetic<HTMLDivElement>(0.15)
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-[1400px] px-6 xl:px-12">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-[36px] p-10 text-center sm:p-20"
            style={{
              background:
                'radial-gradient(ellipse at top left, rgba(96,165,250,0.25), transparent 60%), radial-gradient(ellipse at bottom right, rgba(244,114,182,0.18), transparent 55%), linear-gradient(180deg, rgba(20,22,30,0.9), rgba(12,14,20,0.95))',
              border: '1px solid rgba(96,165,250,0.3)',
            }}
          >
            {/* grid */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(120,120,140,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(120,120,140,0.5) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
              }}
            />
            <div ref={magRef} className="relative inline-block transition-transform duration-300 ease-out">
              <h2
                className="text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl"
                style={{ color: C.text, letterSpacing: '-0.035em' }}
              >
                Your next leak <br />
                <GradientText>shouldn&apos;t make news.</GradientText>
              </h2>
            </div>
            <p className="relative mx-auto mt-6 max-w-xl text-base sm:text-lg" style={{ color: C.textMuted }}>
              Set it up before lunch. Sleep through the night.
            </p>
            <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryButton href="/register">Start free — no card</PrimaryButton>
              <GhostButton href="#pricing">See pricing</GhostButton>
            </div>
            <div className="relative mt-6 text-xs" style={{ color: C.textMuted }}>
              4-minute setup · Free forever for solo devs
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */
function Footer() {
  const cols: Array<{ title: string; links: Array<[string, string]> }> = [
    {
      title: 'Product',
      links: [
        ['Features', '#features'],
        ['How it works', '#how'],
        ['Pricing', '#pricing'],
      ],
    },
    {
      title: 'Account',
      links: [
        ['Sign in', '/login'],
        ['Register', '/register'],
        ['Dashboard', '/'],
      ],
    },
    {
      title: 'Legal',
      links: [
        ['Privacy', '/privacy'],
        ['Terms', '/terms'],
        ['Support', '/support'],
      ],
    },
  ]
  return (
    <footer className="relative border-t" style={{ borderColor: C.border }}>
      <div className="mx-auto w-full max-w-[1600px] px-6 py-16 xl:px-12">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: GRADIENT }}>
                <Shield className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-base font-bold" style={{ color: C.text }}>VaultSentry</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm" style={{ color: C.textMuted }}>
              Built for the engineers who&apos;d rather ship features than chase down 3 AM key rotations.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#93c5fd' }}>
                {c.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm transition-colors"
                      style={{ color: C.textSecondary }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-14 flex flex-col items-center justify-between gap-4 border-t pt-6 text-xs sm:flex-row"
          style={{ borderColor: C.border, color: C.textMuted }}
        >
          <span>© {new Date().getFullYear()} VaultSentry. Built for developers who care about security.</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            All systems normal
          </span>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */
const LANDING_KEYFRAMES = `
  @keyframes vs-blink { to { opacity: 0 } }
  @keyframes vs-marquee {
    from { transform: translate3d(0,0,0) }
    to { transform: translate3d(-50%,0,0) }
  }
  .bento-card {
    transition: transform 400ms cubic-bezier(.2,.7,.2,1), border-color 400ms ease, box-shadow 400ms ease;
    will-change: transform;
  }
  .bento-card:hover {
    transform: translate3d(0,-3px,0);
    border-color: rgba(96,165,250,0.35) !important;
    box-shadow: 0 24px 48px -28px rgba(96,165,250,0.35);
  }
  @media (prefers-reduced-motion: reduce) {
    .bento-card, .bento-card:hover { transform: none !important; }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: C.bg, color: C.text }}>
      <style>{LANDING_KEYFRAMES}</style>
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
