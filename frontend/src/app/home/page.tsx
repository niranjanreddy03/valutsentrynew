'use client'

/**
 * Public marketing landing page.
 *
 * `/` is reserved for the authenticated dashboard (redirects to /login when
 * logged out). This page lives at `/home` so it can be linked from the
 * sign-in / sign-up screens and shared externally without needing an
 * account. The auth context still redirects to `/` after a successful login.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  FileSearch,
  GitBranch,
  Github,
  Lock,
  Play,
  Radar,
  ShieldCheck,
  Siren,
  Sparkles,
  TerminalSquare,
  Workflow,
  Zap,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Radar,
    title: 'Deep scan, fast',
    body: 'Git-aware scanner walks every branch, every file — skipping lockfiles and minified bundles so a 50k-file repo finishes in seconds, not minutes.',
  },
  {
    icon: Workflow,
    title: 'Policies that act',
    body: 'Turn detections into automatic responses: alert Slack, block PRs, file Jira tickets, or rotate AWS keys when a rule matches.',
  },
  {
    icon: FileSearch,
    title: 'Reports you can send',
    body: 'One-click PDF audits — per repository or org-wide — with a risk score, severity breakdown, and the exact files that need attention.',
  },
  {
    icon: Siren,
    title: 'Triage without noise',
    body: 'Per-secret status, ownership, and an ML confidence score so your team spends time on the findings that actually matter.',
  },
  {
    icon: Lock,
    title: 'Secure by default',
    body: 'TOTP multi-factor auth, scoped API keys with expirations, row-level security on every table, and no secret ever leaves your scanner.',
  },
  {
    icon: Zap,
    title: 'Built for CI',
    body: 'Drop VaultSentry into every pull request. Get a check on the PR, a badge for the repo, and regressions blocked before they ship.',
  },
  {
    icon: Cloud,
    title: 'S3 bucket scanning',
    body: 'Point VaultSentry at an AWS S3 bucket and we scan every object — backups, exports, archived configs — for leaked credentials.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Connect a repository',
    body: 'Paste the URL or OAuth with GitHub / GitLab. VaultSentry does a shallow clone — credentials stay in your browser.',
  },
  {
    n: '02',
    title: 'Scan on demand or on push',
    body: 'Run a scan from the dashboard or wire the CLI into CI. Results stream back in seconds with a severity-weighted risk score.',
  },
  {
    n: '03',
    title: 'Respond automatically',
    body: 'Define a policy ("AWS keys in production → Slack + Jira"), and every future detection fires the action without humans in the loop.',
  },
]

const METRICS = [
  { value: '300+', label: 'Secret patterns detected' },
  { value: '<10s', label: 'Typical scan, mid-size repo' },
  { value: '0', label: 'Secrets leave your browser' },
  { value: '24/7', label: 'CI coverage once wired' },
]

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const ctaPrimary = isAuthenticated
    ? { label: 'Open dashboard', href: '/' }
    : { label: 'Create free account', href: '/register' }
  const ctaSecondary = isAuthenticated
    ? { label: 'Run a scan', href: '/repositories' }
    : { label: 'Sign in', href: '/login' }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-0 h-[520px] blur-3xl opacity-60"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,0.35), transparent 70%), radial-gradient(40% 40% at 85% 10%, rgba(14,165,233,0.25), transparent 70%)',
        }}
      />

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/home" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent)] text-white font-bold tracking-tight">
            VS
          </div>
          <span className="text-lg font-semibold tracking-tight">VaultSentry</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Features
          </a>
          <a href="#how" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            How it works
          </a>
          <a href="#pricing" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Pricing
          </a>
          <Link href="/help" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Docs
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              href="/"
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-20 md:pt-20 md:pb-28">
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-700 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            Catch secrets before they ship.
          </div>

          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            The secret-scanning
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
              layer for every repo.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-muted)] md:text-lg">
            VaultSentry finds API keys, tokens, and credentials in your code —
            then automates the response, from Slack alerts to Jira tickets to
            full credential rotation. All in one pane of glass.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={ctaPrimary.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition-all hover:translate-y-[-1px] hover:opacity-95"
            >
              <Play className="h-4 w-4 fill-current" />
              {ctaPrimary.label}
            </Link>
            <Link
              href={ctaSecondary.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 py-3 text-sm font-semibold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Github className="h-4 w-4" />
              {ctaSecondary.label}
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Free tier, no card
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Self-host in 5 minutes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Source available
            </span>
          </div>
        </div>

        {/* faux dashboard preview */}
        <div
          className={`relative mx-auto mt-16 max-w-5xl transition-all delay-200 duration-700 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl">
            {/* window chrome */}
            <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <div className="ml-4 flex-1 rounded-md bg-[var(--bg-tertiary)] px-3 py-1 font-mono text-xs text-[var(--text-muted)]">
                thevaultsentry.com/dashboard
              </div>
            </div>
            {/* body */}
            <div className="grid gap-4 p-6 md:grid-cols-3">
              <DemoCard
                tone="rose"
                Icon={Siren}
                title="3 critical"
                sub="AWS keys, 2 repos"
                meta="· 1 just now"
              />
              <DemoCard
                tone="amber"
                Icon={ShieldCheck}
                title="Policy fired"
                sub="Block PR · billing-api"
                meta="· slack sent"
              />
              <DemoCard
                tone="emerald"
                Icon={GitBranch}
                title="17 repos scanned"
                sub="CI coverage · 100%"
                meta="· today"
              />

              {/* feed row */}
              <div className="md:col-span-3">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  Recent findings
                </div>
                <div className="divide-y divide-[var(--border-color)] rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]/60">
                  {[
                    {
                      sev: 'crit',
                      type: 'AWS Access Key',
                      path: 'billing-api/config/prod.env',
                      when: '2m',
                    },
                    {
                      sev: 'high',
                      type: 'Stripe Secret Key',
                      path: 'checkout-service/src/billing.ts',
                      when: '18m',
                    },
                    {
                      sev: 'med',
                      type: 'JWT Secret',
                      path: 'auth-gateway/lib/jwt.config.js',
                      when: '1h',
                    },
                  ].map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs"
                    >
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 font-semibold uppercase tracking-wider ${
                          r.sev === 'crit'
                            ? 'bg-rose-500/15 text-rose-400'
                            : r.sev === 'high'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-sky-500/15 text-sky-400'
                        }`}
                      >
                        {r.sev}
                      </span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {r.type}
                      </span>
                      <span className="truncate font-mono text-[var(--text-muted)]">
                        {r.path}
                      </span>
                      <span className="ml-auto text-[var(--text-muted)]">
                        {r.when} ago
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* glow underneath */}
          <div
            aria-hidden
            className="absolute inset-x-10 -bottom-10 -z-10 h-24 rounded-full bg-[var(--accent)] blur-3xl opacity-20"
          />
        </div>
      </section>

      {/* metrics */}
      <section className="relative z-10 border-y border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-10 md:grid-cols-4 md:gap-8">
          {METRICS.map((m) => (
            <div key={m.label} className="text-center">
              <div className="text-2xl font-bold tracking-tight text-[var(--text-primary)] md:text-3xl">
                {m.value}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-[var(--text-muted)]">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            What you get
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Detection is table stakes. We ship the response too.
          </h2>
          <p className="mt-4 text-[var(--text-muted)]">
            Every feature maps to something a platform team would otherwise glue
            together from three tools and a spreadsheet.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]/40"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--accent)] opacity-0 blur-3xl transition-opacity group-hover:opacity-10"
              />
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section
        id="how"
        className="relative z-10 border-y border-[var(--border-color)] bg-[var(--bg-secondary)]/40"
      >
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              How it works
            </div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Three steps. Under five minutes.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6"
              >
                <div className="mb-6 flex items-center gap-3">
                  <div className="font-mono text-xs font-semibold text-[var(--accent)]">
                    {s.n}
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-[var(--accent)]/50 to-transparent" />
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  {s.body}
                </p>
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-[var(--accent)]/40 md:block"
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* code / CLI teaser */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              Drop it into CI
            </div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              One YAML change, every PR covered.
            </h2>
            <p className="mt-4 text-[var(--text-muted)]">
              The VaultSentry GitHub Action runs on every push, posts a check on
              the pull request, and writes findings back to your dashboard —
              with policy enforcement applied before a merge is even possible.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/help"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                Read the CI guide
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/api-keys"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <TerminalSquare className="h-4 w-4" />
                Create an API key
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
            <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-2.5">
              <TerminalSquare className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <span className="font-mono text-xs text-[var(--text-muted)]">
                .github/workflows/vaultsentry.yml
              </span>
            </div>
            <pre className="overflow-x-auto bg-[var(--bg-primary)] p-5 font-mono text-[12.5px] leading-relaxed">
              <code>
                <span className="text-purple-400">name</span>
                <span className="text-[var(--text-muted)]">:</span>{' '}
                <span className="text-emerald-300">Secret scan</span>
                {'\n'}
                <span className="text-purple-400">on</span>
                <span className="text-[var(--text-muted)]">:</span>{' '}
                <span className="text-sky-300">[pull_request]</span>
                {'\n\n'}
                <span className="text-purple-400">jobs</span>
                <span className="text-[var(--text-muted)]">:</span>
                {'\n  '}
                <span className="text-purple-400">scan</span>
                <span className="text-[var(--text-muted)]">:</span>
                {'\n    '}
                <span className="text-purple-400">runs-on</span>
                <span className="text-[var(--text-muted)]">:</span>{' '}
                <span className="text-emerald-300">ubuntu-latest</span>
                {'\n    '}
                <span className="text-purple-400">steps</span>
                <span className="text-[var(--text-muted)]">:</span>
                {'\n      '}
                <span className="text-[var(--text-muted)]">-</span>{' '}
                <span className="text-purple-400">uses</span>
                <span className="text-[var(--text-muted)]">:</span>{' '}
                <span className="text-emerald-300">vaultsentry/scan@v1</span>
                {'\n        '}
                <span className="text-purple-400">with</span>
                <span className="text-[var(--text-muted)]">:</span>
                {'\n          '}
                <span className="text-purple-400">api_key</span>
                <span className="text-[var(--text-muted)]">:</span>{' '}
                <span className="text-sky-300">$&#123;&#123; secrets.VS_KEY &#125;&#125;</span>
                {'\n          '}
                <span className="text-purple-400">fail_on</span>
                <span className="text-[var(--text-muted)]">:</span>{' '}
                <span className="text-emerald-300">critical</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section
        id="pricing"
        className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-24"
      >
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1 text-xs text-[var(--text-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            Pricing
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Simple plans. Priced in{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
              rupees
            </span>
            .
          </h2>
          <p className="mt-3 text-[var(--text-muted)]">
            Start free, upgrade when you outgrow it. Cancel anytime — no lock-in.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Basic */}
          <PricingCard
            name="Basic"
            priceLabel="Free"
            tagline="For personal projects."
            features={[
              '1 repository',
              '1 scan / week',
              '7 days history',
              'Email alerts',
            ]}
            ctaLabel={isAuthenticated ? 'Open dashboard' : 'Get started free'}
            onClick={() => router.push(isAuthenticated ? '/' : '/register')}
          />

          {/* Premium */}
          <PricingCard
            name="Premium"
            priceLabel="₹299"
            priceSuffix="/mo"
            tagline="For growing teams."
            popular
            features={[
              '10 repositories',
              '50 scans / week',
              '30 days history',
              'Slack + Jira integrations',
              'ML risk scoring',
              'Scheduled scans',
            ]}
            ctaLabel="Upgrade to Premium"
            onClick={() =>
              router.push(isAuthenticated ? '/pricing' : '/register?redirect=/pricing')
            }
          />

          {/* Premium Plus */}
          <PricingCard
            name="Premium Plus"
            priceLabel="₹999"
            priceSuffix="/mo"
            tagline="For security-first orgs."
            features={[
              'Unlimited repositories',
              'Unlimited scans',
              '365 days history',
              'SSO / SAML + audit logs',
              'Auto secret rotation',
              'Priority support',
            ]}
            ctaLabel="Upgrade to Premium Plus"
            onClick={() =>
              router.push(isAuthenticated ? '/pricing' : '/register?redirect=/pricing')
            }
          />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          All prices in INR. Save ~17% on yearly billing.
        </p>
      </section>

      {/* final CTA */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] px-8 py-14 text-center md:px-14 md:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 80% at 50% 0%, rgba(99,102,241,0.18), transparent 70%)',
            }}
          />
          <h2 className="relative text-3xl font-bold tracking-tight md:text-4xl">
            Ship with confidence.
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
              Leak zero credentials.
            </span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[var(--text-muted)]">
            Start free. Scan your first repository in under a minute. No credit
            card, no waiting list.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push(isAuthenticated ? '/' : '/register')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition-all hover:-translate-y-0.5"
            >
              {isAuthenticated ? 'Open the dashboard' : 'Create your free account'}
              <ArrowRight className="h-4 w-4" />
            </button>
            {!isAuthenticated && (
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 py-3 text-sm font-semibold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                I already have an account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-[var(--text-muted)] md:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--accent)] text-white font-bold text-xs">
              VS
            </div>
            <span>© {new Date().getFullYear()} VaultSentry</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors">
              Terms
            </Link>
            <Link href="/help" className="hover:text-[var(--text-primary)] transition-colors">
              Docs
            </Link>
            <Link href="/pricing" className="hover:text-[var(--text-primary)] transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

function DemoCard({
  tone,
  Icon,
  title,
  sub,
  meta,
}: {
  tone: 'rose' | 'amber' | 'emerald'
  Icon: React.ComponentType<{ className?: string }>
  title: string
  sub: string
  meta: string
}) {
  const palette = {
    rose: {
      border: 'border-rose-500/30',
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
    },
    amber: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
    },
    emerald: {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
    },
  }[tone]

  return (
    <div className={`rounded-lg border ${palette.border} ${palette.bg} p-4`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${palette.text}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${palette.text}`}>
          {title}
        </span>
      </div>
      <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{sub}</div>
      <div className="mt-0.5 text-xs text-[var(--text-muted)]">{meta}</div>
    </div>
  )
}

function PricingCard({
  name,
  priceLabel,
  priceSuffix,
  tagline,
  features,
  ctaLabel,
  onClick,
  popular,
}: {
  name: string
  priceLabel: string
  priceSuffix?: string
  tagline: string
  features: string[]
  ctaLabel: string
  onClick: () => void
  popular?: boolean
}) {
  return (
    <div
      className="relative flex flex-col rounded-2xl p-7 transition-transform"
      style={{
        background: 'var(--card-bg)',
        border: popular ? '1px solid var(--accent)' : '1px solid var(--border-color)',
        boxShadow: popular
          ? '0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent)'
          : 'none',
        transform: popular ? 'translateY(-6px)' : 'none',
      }}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Most Popular
          </span>
        </div>
      )}

      <div className="text-lg font-semibold text-[var(--text-primary)]">{name}</div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{tagline}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
          {priceLabel}
        </span>
        {priceSuffix && (
          <span className="text-sm text-[var(--text-muted)]">{priceSuffix}</span>
        )}
      </div>

      <ul className="mt-6 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onClick}
        className="mt-7 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
        style={{
          background: popular ? 'var(--accent)' : 'var(--bg-secondary)',
          color: popular ? 'white' : 'var(--text-primary)',
          border: popular ? 'none' : '1px solid var(--border-color)',
          boxShadow: popular ? '0 10px 30px rgba(99,102,241,0.35)' : 'none',
        }}
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}
