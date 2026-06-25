'use client'

import { useEffect, useState, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft, Check } from 'lucide-react'

interface Section {
  id: string
  title: string
  body: ReactNode
}

const SECTIONS: Section[] = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    body: (
      <>
        By creating a VaultSentry account or using our services, you agree to these Terms. If you
        are using VaultSentry on behalf of an organization, you represent that you have authority
        to bind that organization.
      </>
    ),
  },
  {
    id: 'service',
    title: '2. The Service',
    body: (
      <>
        VaultSentry provides automated secret-scanning and remediation tooling for source code,
        CI/CD artifacts, and cloud configurations. We continuously improve detection rules; scan
        results are provided on an as-is basis.
      </>
    ),
  },
  {
    id: 'data',
    title: '3. How We Handle Your Code',
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Code is scanned in-memory and never persisted to disk unless you enable archival.</li>
        <li>Raw secret values are masked before being stored or shown in dashboards.</li>
        <li>You can enable zero-retention mode to discard scan inputs immediately after analysis.</li>
      </ul>
    ),
  },
  {
    id: 'accounts',
    title: '4. Accounts &amp; Security',
    body: (
      <>
        You are responsible for maintaining the confidentiality of your credentials and for all
        activity under your account. We strongly recommend enabling two-factor authentication.
        Notify us immediately of any unauthorized use.
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: '5. Acceptable Use',
    body: (
      <>
        You agree not to misuse VaultSentry — including attempting to reverse-engineer the
        service, scanning code you do not have permission to scan, or using findings to attack
        third-party systems.
      </>
    ),
  },
  {
    id: 'billing',
    title: '6. Subscriptions &amp; Billing',
    body: (
      <>
        Paid plans renew automatically at the end of each billing period. You may cancel at any
        time; cancellations take effect at the end of the current period. Refunds are issued at
        our discretion for service failures.
      </>
    ),
  },
  {
    id: 'ip',
    title: '7. Intellectual Property',
    body: (
      <>
        You retain all rights to your code and scan results. VaultSentry retains all rights to
        our software, detectors, and brand assets. You grant us a limited license to process
        your content solely to operate the service.
      </>
    ),
  },
  {
    id: 'liability',
    title: '8. Limitation of Liability',
    body: (
      <>
        To the maximum extent permitted by law, VaultSentry’s aggregate liability for any claim
        arising out of the service is limited to the amount you paid us in the 12 months preceding
        the claim.
      </>
    ),
  },
  {
    id: 'changes',
    title: '9. Changes to These Terms',
    body: (
      <>
        We may update these Terms occasionally. Material changes will be notified by email or
        in-app banner at least 30 days before they take effect.
      </>
    ),
  },
  {
    id: 'contact',
    title: '10. Contact',
    body: (
      <>
        Questions? Email{' '}
        <a href="mailto:legal@thevaultsentry.com" className="text-cyber-cyan hover:underline">
          legal@thevaultsentry.com
        </a>
        .
      </>
    ),
  },
]

export default function TermsPage() {
  const router = useRouter()
  const [activeId, setActiveId] = useState(SECTIONS[0].id)
  const [accepted, setAccepted] = useState(false)

  // Highlight active TOC item
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId(e.target.id)
        })
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const handleAccept = () => {
    try {
      localStorage.setItem('vs_terms_accepted_at', new Date().toISOString())
    } catch {}
    setAccepted(true)
    setTimeout(() => router.push('/register'), 700)
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, rgba(6,182,212,0.14), rgba(59,130,246,0.08) 45%, transparent 75%)',
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyber-blue to-cyber-cyan shadow-glow-sm">
              <Shield className="h-4 w-4 text-white" strokeWidth={2.2} />
            </span>
            <span className="text-base font-semibold text-white">
              Vault<span className="text-cyber-cyan">Sentry</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <div className="mb-10 space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
            Last updated · April 17, 2026
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Terms of Service
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            Plain-language terms for using VaultSentry. We try to keep this short. The important
            parts about how we handle your code are in{' '}
            <a href="#data" className="text-cyber-cyan hover:underline">
              section 3
            </a>
            .
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* Sticky TOC */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1 text-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                On this page
              </p>
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={[
                    'block rounded-lg px-3 py-1.5 transition-colors',
                    activeId === s.id
                      ? 'bg-cyber-cyan/10 text-cyber-cyan'
                      : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200',
                  ].join(' ')}
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          {/* Sections */}
          <div className="space-y-4">
            {SECTIONS.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-28 rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-sm sm:p-7"
              >
                <h2 className="mb-3 text-lg font-semibold text-white">{s.title}</h2>
                <div className="text-sm leading-relaxed text-slate-300">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Accept bar */}
      <div className="sticky bottom-0 z-20 border-t border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <p className="text-xs text-slate-400 sm:text-sm">
            By accepting, you agree to the terms above and our{' '}
            <Link href="/privacy" className="text-slate-200 underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepted}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cyber-blue to-cyber-cyan px-5 py-2.5 text-sm font-medium text-white shadow-glow-sm transition-all hover:shadow-glow-md disabled:opacity-70"
          >
            {accepted ? (
              <>
                <Check className="h-4 w-4" /> Accepted
              </>
            ) : (
              'Accept and continue'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
