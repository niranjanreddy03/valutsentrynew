'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Bug,
  Check,
  ChevronRight,
  Lock,
  Radar,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Palette tokens                                                     */
/* ------------------------------------------------------------------ */
// Pull directly from the dashboard's CSS variables so the landing page
// matches whatever theme the dashboard is in (light or dark).
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
  accentGlow: 'var(--accent-glow)',
  // fixed semantic (same in light/dark): success green for check marks
  green: '#22c55e',
}

const GRADIENT = `linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)`

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */
function GradientText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={className}
      style={{
        background: GRADIENT,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {children}
    </span>
  )
}

function GradientButton({
  children,
  href,
  className = '',
  leading,
  trailing,
}: {
  children: React.ReactNode
  href: string
  className?: string
  leading?: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${className}`}
      style={{
        background: GRADIENT,
        boxShadow: '0 10px 30px -10px rgba(59, 130, 246, 0.5), 0 4px 12px -4px rgba(139, 92, 246, 0.35)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }}
      />
      {leading}
      <span className="relative z-10">{children}</span>
      {trailing ?? (
        <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      )}
    </Link>
  )
}

function GlassButton({
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06] ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {leading}
      {children}
    </Link>
  )
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: React.ReactNode
  subtitle: string
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: C.accentHover }}
      >
        {eyebrow}
      </div>
      <h2 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl" style={{ letterSpacing: '-0.02em' }}>
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg" style={{ color: C.textMuted }}>
        {subtitle}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Nav                                                                */
/* ------------------------------------------------------------------ */
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(11, 15, 23, 0.72)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px) saturate(180%)' : 'none',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
      }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: GRADIENT, boxShadow: '0 6px 16px -4px rgba(59,130,246,0.55)' }}
          >
            <Shield className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-bold tracking-tight" style={{ color: C.text }}>
            VaultSentry
          </span>
        </Link>

        <div className="hidden items-center gap-10 md:flex">
          {[
            ['Features', '#features'],
            ['How it works', '#how'],
            ['Pricing', '#pricing'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-base font-medium transition-colors"
              style={{ color: C.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden text-base font-semibold transition-colors sm:inline-flex"
            style={{ color: C.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
          >
            Sign in
          </Link>
          <GradientButton href="/register" className="!px-5 !py-2.5 !text-sm">
            Get started
          </GradientButton>
        </div>
      </nav>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero backdrop (grid + glows + orbs)                                */
/* ------------------------------------------------------------------ */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(82,82,82,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(82,82,82,0.25) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at top, black 40%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top, black 40%, transparent 75%)',
        }}
      />
      <div
        className="absolute -top-40 left-1/2 h-[520px] w-[880px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, rgba(59,130,246,0.35), transparent)' }}
      />
      <div
        className="absolute -top-10 right-[-10%] h-[420px] w-[520px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, rgba(59,130,246,0.18), transparent)' }}
      />
      <div
        className="absolute left-[8%] top-[30%] h-2 w-2 rounded-full animate-pulse"
        style={{ background: C.accentHover, boxShadow: `0 0 24px ${C.accentHover}` }}
      />
      <div
        className="absolute right-[12%] top-[55%] h-1.5 w-1.5 rounded-full animate-pulse"
        style={{ background: C.accent, boxShadow: `0 0 20px ${C.accent}`, animationDelay: '0.8s' }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-36 sm:pb-32 sm:pt-40">
      <HeroBackdrop />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <div
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium backdrop-blur-md animate-fade-in"
          style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            color: C.accentHover,
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Now in early access
        </div>

        <h1
          className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl animate-slide-down"
          style={{ letterSpacing: '-0.03em' }}
        >
          Secure your digital world
          <br />
          with <GradientText>VaultSentry</GradientText>
        </h1>

        <p
          className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed sm:text-xl animate-fade-in"
          style={{ color: C.textMuted, animationDelay: '0.15s' }}
        >
          Secret scanning and security monitoring for your repositories — built for developers who can&apos;t afford
          to leak a single credential.
        </p>

        <div
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-in"
          style={{ animationDelay: '0.3s' }}
        >
          <GradientButton href="/register">Get started — it&apos;s free</GradientButton>
          <GlassButton href="/login" leading={<BarChart3 className="h-4 w-4" />}>
            View dashboard
          </GlassButton>
        </div>

        <div
          className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs animate-fade-in"
          style={{ color: C.textMuted, animationDelay: '0.45s' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" style={{ color: C.green }} /> Free to start
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" style={{ color: C.green }} /> No credit card
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" style={{ color: C.green }} /> Minutes to set up
          </span>
        </div>
      </div>

      <ProductPreview />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Product preview                                                    */
/* ------------------------------------------------------------------ */
function ProductPreview() {
  return (
    <div className="relative mx-auto mt-20 max-w-6xl px-6 animate-fade-in" style={{ animationDelay: '0.6s' }}>
      <div
        className="relative rounded-2xl p-2"
        style={{
          background: 'linear-gradient(180deg, rgba(59,130,246,0.25), rgba(59,130,246,0.08) 40%, transparent)',
        }}
      >
        <div className="overflow-hidden rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: C.border, background: '#141414' }}>
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
            <span className="ml-3 font-mono text-xs" style={{ color: C.textMuted }}>
              vaultsentry.app/dashboard
            </span>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-3">
            {[
              { label: 'Secret scanning', icon: Radar, color: C.accentHover, sub: 'Continuous' },
              { label: 'Threat detection', icon: ShieldCheck, color: C.green, sub: 'Real-time' },
              { label: 'Active monitors', icon: Activity, color: C.accent, sub: 'Always-on' },
            ].map(({ label, icon: Icon, color, sub }) => (
              <div
                key={label}
                className="rounded-xl p-4"
                style={{ background: C.surfaceStrong, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: C.textMuted }}>
                    {label}
                  </span>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-white">{sub}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 px-6 pb-6 lg:grid-cols-5">
            <div
              className="rounded-xl p-5 lg:col-span-3"
              style={{ background: C.surfaceStrong, border: `1px solid ${C.border}` }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Scan activity</span>
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: 'rgba(16,185,129,0.15)', color: C.green }}
                >
                  ● Live
                </span>
              </div>
              <MockChart />
            </div>

            <div
              className="rounded-xl p-5 lg:col-span-2"
              style={{ background: C.surfaceStrong, border: `1px solid ${C.border}` }}
            >
              <div className="mb-3 text-sm font-medium text-white">What you&apos;ll see</div>
              <ul className="space-y-2.5 text-[12px]">
                {[
                  'Findings grouped by severity',
                  'Repository risk ranking',
                  'Secret lifecycle timeline',
                  'Owner-routed alerts',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.green }} />
                    <span style={{ color: C.text }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockChart() {
  const pts = [10, 24, 18, 32, 27, 48, 38, 62, 54, 71, 64, 82]
  const max = 100
  const w = 520
  const h = 140
  const step = w / (pts.length - 1)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / max) * h}`).join(' ')
  const area = `${path} L ${w} ${h} L 0 ${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.5" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="line-stroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={C.accentHover} />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#area-fill)" />
      <path d={path} stroke="url(#line-stroke)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Features                                                           */
/* ------------------------------------------------------------------ */
const FEATURES = [
  { icon: Radar, title: 'Secret scanning', desc: 'Detect leaked API keys, tokens, and credentials across your repositories.' },
  { icon: Zap, title: 'Findings dashboard', desc: 'Browse, triage, and track secret findings with severity, status, and owner context.' },
  { icon: Bug, title: 'Severity grouping', desc: 'Findings ranked by risk so you know what to fix first — no noise, no guesswork.' },
  { icon: Bell, title: 'Alerts & activity feed', desc: 'Stay on top of scans, findings, and account activity from a single timeline.' },
  { icon: Lock, title: 'Private by design', desc: 'Your data stays yours. Scan results are scoped to your account and never shared.' },
]

function Features() {
  return (
    <section id="features" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Features"
          title={
            <>
              Everything you need to <GradientText>stay secure</GradientText>
            </>
          }
          subtitle="The essentials for catching leaked secrets before they become incidents."
        />

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)'
                e.currentTarget.style.boxShadow = '0 20px 40px -20px rgba(59,130,246,0.35)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: 'radial-gradient(closest-side, rgba(59,130,246,0.25), transparent)' }}
              />
              <div
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: GRADIENT, boxShadow: '0 8px 20px -8px rgba(59,130,246,0.55)' }}
              >
                <Icon className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.textMuted }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  How it works                                                       */
/* ------------------------------------------------------------------ */
function HowItWorks() {
  const steps = [
    { n: '01', title: 'Create your account', desc: 'Sign up with email in under a minute. No credit card, no config files.' },
    { n: '02', title: 'Scan your code', desc: 'Run scans against your repositories and surface any exposed secrets or credentials.' },
    { n: '03', title: 'Review & remediate', desc: 'Triage findings by severity, track their status, and rotate what needs rotating.' },
  ]
  return (
    <section
      id="how"
      className="relative py-28"
      style={{ background: 'linear-gradient(180deg, transparent, rgba(17,24,39,0.6), transparent)' }}
    >
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="How it works"
          title={
            <>
              Three steps. <GradientText>Zero friction.</GradientText>
            </>
          }
          subtitle="Sign up, scan, and start reviewing findings — all in a few minutes."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <div
                className="relative rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <div
                  className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl font-mono text-sm font-bold text-white"
                  style={{ background: GRADIENT, boxShadow: '0 10px 24px -10px rgba(59,130,246,0.45)' }}
                >
                  {s.n}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: C.textMuted }}>
                  {s.desc}
                </p>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight
                  aria-hidden
                  className="absolute -right-4 top-1/2 hidden h-6 w-6 -translate-y-1/2 md:block"
                  style={{ color: C.textMuted }}
                />
              )}
            </div>
          ))}
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
      name: 'Basic',
      price: 'Free',
      period: 'forever',
      desc: 'For solo developers getting started.',
      features: [
        '1 repository',
        '1 scan / week',
        '7 days history',
        'Email alerts',
      ],
      cta: 'Get started',
      href: '/register',
      highlight: false,
    },
    {
      name: 'Premium',
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
      cta: 'Start Premium',
      href: '/register?redirect=/pricing',
      highlight: true,
    },
    {
      name: 'Premium Plus',
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
      cta: 'Start Premium Plus',
      href: '/register?redirect=/pricing',
      highlight: false,
    },
  ]
  return (
    <section id="pricing" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Pricing"
          title={
            <>
              Simple, <GradientText>honest pricing</GradientText>
            </>
          }
          subtitle="Start free. Upgrade when you need more horsepower. No surprise invoices."
        />

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className="relative rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: t.highlight
                  ? 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))'
                  : C.surface,
                border: t.highlight ? '1px solid rgba(59,130,246,0.5)' : `1px solid ${C.border}`,
                boxShadow: t.highlight ? '0 30px 60px -30px rgba(59,130,246,0.45)' : 'none',
              }}
            >
              {t.highlight && (
                <div
                  className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ background: GRADIENT, boxShadow: '0 8px 20px -8px rgba(59,130,246,0.45)' }}
                >
                  <Sparkles className="h-3 w-3" />
                  Most popular
                </div>
              )}
              <h3 className="text-base font-semibold text-white">{t.name}</h3>
              <p className="mt-1 text-xs" style={{ color: C.textMuted }}>
                {t.desc}
              </p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{t.price}</span>
                {t.period && (
                  <span className="text-xs" style={{ color: C.textMuted }}>
                    / {t.period}
                  </span>
                )}
              </div>
              <ul className="mt-6 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: C.text }}>
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.green }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                {t.highlight ? (
                  <GradientButton href={t.href} className="w-full">
                    {t.cta}
                  </GradientButton>
                ) : (
                  <GlassButton href={t.href} className="w-full">
                    {t.cta}
                  </GlassButton>
                )}
              </div>
            </div>
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
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div
          className="relative overflow-hidden rounded-3xl p-10 text-center sm:p-16"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))',
            border: '1px solid rgba(59,130,246,0.35)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.25), transparent 60%)' }}
          />
          <h2
            className="relative text-3xl font-bold tracking-tight text-white sm:text-5xl"
            style={{ letterSpacing: '-0.02em' }}
          >
            Start securing <GradientText>now.</GradientText>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base sm:text-lg" style={{ color: C.textMuted }}>
            Create a free account and run your first scan in minutes. No credit card required.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GradientButton href="/register">Start securing now</GradientButton>
            <GlassButton href="#pricing">See pricing</GlassButton>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */
function Footer() {
  const links: Array<[string, string]> = [
    ['Features', '#features'],
    ['How it works', '#how'],
    ['Pricing', '#pricing'],
    ['Sign in', '/login'],
  ]
  return (
    <footer className="relative border-t" style={{ borderColor: C.border }}>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: GRADIENT }}>
              <Shield className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold text-white">VaultSentry</span>
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {links.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-sm transition-colors"
                style={{ color: C.textMuted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div
          className="mt-8 border-t pt-6 text-center text-xs"
          style={{ borderColor: C.border, color: C.textMuted }}
        >
          © {new Date().getFullYear()} VaultSentry. Built for developers who care about security.
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: C.bg, color: C.text }}>
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
