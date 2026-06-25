'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Turnstile } from '@/components/auth'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  Clock,
  LifeBuoy,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

const SLA_BY_TIER: Record<string, { label: string; sla: string; color: string }> = {
  basic: { label: 'Community', sla: 'Best-effort · 48h', color: '#a3a3a3' },
  premium: { label: 'Standard', sla: 'Business hours · 8h', color: '#60a5fa' },
  premium_plus: { label: 'Priority', sla: '24/7 · 1h response', color: '#a78bfa' },
}

export default function SupportPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [subject, setSubject] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaNonce, setCaptchaNonce] = useState(0)
  const captchaEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const tier = (user?.subscription_tier || 'basic') as keyof typeof SLA_BY_TIER
  const sla = SLA_BY_TIER[tier] ?? SLA_BY_TIER.basic
  const isPriority = tier === 'premium_plus'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      showToast('Subject and message are required', 'warning')
      return
    }
    if (captchaEnabled && !captchaToken) {
      showToast('Please complete the captcha', 'warning')
      return
    }
    setSending(true)

    // Mirror the ticket to localStorage immediately so the user has a
    // record even if the network hiccups. This survives API failures.
    const localTicket = {
      id: crypto.randomUUID?.() || String(Date.now()),
      subject,
      severity,
      message,
      email: user?.email,
      tier,
      createdAt: new Date().toISOString(),
    }
    try {
      const key = 'vaultsentry_support_tickets'
      const raw = window.localStorage.getItem(key)
      const list = raw ? JSON.parse(raw) : []
      list.unshift(localTicket)
      window.localStorage.setItem(key, JSON.stringify(list.slice(0, 50)))
    } catch {
      // localStorage can fail in private mode — non-fatal.
    }

    try {
      // Send from the website itself via our /api/support endpoint. No
      // more mailto hand-off — the backend delivers the message.
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          severity,
          email: user?.email,
          tier,
          name: (user as any)?.full_name,
          captchaToken: captchaToken ?? undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.success) {
        const delivered: string[] = []
        if (data.emailed) delivered.push('emailed support team')
        if (data.slacked) delivered.push('pinged Slack')
        if (data.persisted) delivered.push('saved to queue')
        const suffix = delivered.length ? ` · ${delivered.join(' · ')}` : ''
        showToast(
          isPriority
            ? `Priority ticket received — we'll respond within 1 hour${suffix}`
            : `Ticket received${suffix}`,
          'success',
        )
        setSubject('')
        setMessage('')
        setSeverity('medium')
        setCaptchaToken(null)
        setCaptchaNonce((n) => n + 1)
      } else {
        setCaptchaToken(null)
        setCaptchaNonce((n) => n + 1)
        // Backend couldn't deliver — surface the reason instead of pretending it worked.
        const reason =
          (Array.isArray(data.errors) && data.errors.join(' · ')) ||
          data.error ||
          `HTTP ${res.status}`
        showToast(`Couldn't deliver ticket: ${reason}`, 'error')
      }
    } catch (err: any) {
      showToast(
        `Couldn't reach support: ${err?.message || 'network error'}`,
        'error',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1">
        <Header />
        <main className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
                <LifeBuoy className="h-6 w-6 text-[var(--accent)]" />
                Support
              </h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Get help from the VaultSentry team. Response times depend on your
                plan.
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                border: `1px solid ${sla.color}`,
                color: sla.color,
                background: `${sla.color}15`,
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {sla.label} support
            </span>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <SupportStat
              icon={<Clock className="h-4 w-4" style={{ color: sla.color }} />}
              label="Target response"
              value={sla.sla}
            />
            <SupportStat
              icon={<Zap className="h-4 w-4 text-amber-400" />}
              label="Channels"
              value={isPriority ? 'Email · Slack · Phone' : 'Email only'}
            />
            <SupportStat
              icon={<Sparkles className="h-4 w-4 text-[var(--accent)]" />}
              label="Dedicated engineer"
              value={isPriority ? 'Yes' : 'No'}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
            <form
              onSubmit={submit}
              className="rounded-2xl p-6"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
              }}
            >
              <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                Open a ticket
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Subject
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Scan failing on repo X"
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Severity
                  </label>
                  <div className="mt-1 flex gap-2">
                    {(['low', 'medium', 'high'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeverity(s)}
                        className="rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors"
                        style={{
                          background:
                            severity === s ? 'var(--accent)' : 'var(--bg-secondary)',
                          color:
                            severity === s ? 'white' : 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Describe the issue
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    placeholder="Steps to reproduce, expected behaviour, and anything else we should know…"
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                {captchaEnabled && (
                  <Turnstile
                    resetKey={captchaNonce}
                    onVerify={(t) => setCaptchaToken(t)}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => setCaptchaToken(null)}
                  />
                )}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    Delivered directly from VaultSentry — no email client required.
                  </p>
                  <button
                    type="submit"
                    disabled={sending || (captchaEnabled && !captchaToken)}
                    className="btn btn-primary"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? 'Sending…' : 'Send ticket'}
                  </button>
                </div>
              </div>
            </form>

            <aside className="space-y-4">
              <div
                className="rounded-2xl p-5"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                  Direct channels
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a
                      href="mailto:support@thevaultsentry.com"
                      className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent)]"
                    >
                      <Mail className="h-4 w-4" /> support@thevaultsentry.com
                    </a>
                  </li>
                  {isPriority && (
                    <>
                      <li>
                        <a
                          href="#"
                          className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent)]"
                        >
                          <MessageCircle className="h-4 w-4" /> Shared Slack
                          channel
                        </a>
                      </li>
                      <li className="text-[var(--text-muted)]">
                        <span className="flex items-center gap-2">
                          <LifeBuoy className="h-4 w-4" /> +1 (555) 010-9911
                        </span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {!isPriority && (
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
                    border: '1px solid var(--accent)',
                  }}
                >
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                    Upgrade to Priority
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    24/7 response within 1 hour, a dedicated engineer, and a
                    shared Slack channel.
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    See Premium Plus
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}

function SupportStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        {icon} {label}
      </div>
      <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">{value}</div>
    </div>
  )
}
