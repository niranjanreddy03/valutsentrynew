/**
 * POST /api/support — Submit a support ticket from the in-app form.
 *
 * Design:
 *   1. Validate the ticket payload (subject + message required).
 *   2. Persist to Supabase `support_tickets` if configured so the team has a
 *      durable record even if email delivery fails.
 *   3. Send a transactional email to `support@thevaultsentry.com` via Resend
 *      (`RESEND_API_KEY`) so the on-call engineer is paged immediately.
 *      - For priority-tier users we also post to `SUPPORT_SLACK_WEBHOOK_URL`
 *        if present so the ticket lands in the shared Slack channel.
 *   4. Return a structured outcome so the UI can give an accurate toast
 *      instead of opening the user's mail client.
 *
 * Any step can fail without blocking the others — we return what we
 * achieved so the UI stays useful even when a provider is misconfigured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyTurnstile, getClientIp } from '@/lib/turnstile'

interface SupportPayload {
  subject: string
  message: string
  severity: 'low' | 'medium' | 'high'
  email?: string
  tier?: string
  name?: string
  captchaToken?: string
}

const SUPPORT_INBOX = 'support@thevaultsentry.com'
const FROM_ADDRESS =
  process.env.SUPPORT_FROM_ADDRESS || 'VaultSentry Support <support@thevaultsentry.com>'

export async function POST(request: NextRequest) {
  let payload: SupportPayload
  try {
    payload = (await request.json()) as SupportPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { subject, message, severity, email, tier, name, captchaToken } = payload
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json(
      { error: 'Subject and message are required' },
      { status: 400 },
    )
  }

  const captcha = await verifyTurnstile(captchaToken, getClientIp(request.headers))
  if (!captcha.success) {
    return NextResponse.json(
      { error: 'Captcha verification failed', errorCodes: captcha.errorCodes },
      { status: 400 },
    )
  }

  const ticket = {
    id: (globalThis.crypto as Crypto | undefined)?.randomUUID?.() || String(Date.now()),
    subject: subject.trim(),
    message: message.trim(),
    severity: severity || 'medium',
    email: email || null,
    tier: tier || 'basic',
    name: name || null,
    created_at: new Date().toISOString(),
    user_agent: request.headers.get('user-agent') || null,
    origin: request.headers.get('origin') || null,
  }

  const outcome = {
    ticketId: ticket.id,
    persisted: false,
    emailed: false,
    slacked: false,
    errors: [] as string[],
  }

  // 1) Persist to Supabase if configured.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { error } = await supabase.from('support_tickets').insert(ticket)
      if (error) {
        outcome.errors.push(`persist: ${error.message}`)
      } else {
        outcome.persisted = true
      }
    } catch (e: any) {
      outcome.errors.push(`persist: ${e?.message || 'supabase insert failed'}`)
    }
  }

  // 2) Email the on-call team via Resend.
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [SUPPORT_INBOX],
          // Let the user reply directly if they have email set up — this
          // threads subsequent conversation straight back to them.
          reply_to: email || undefined,
          subject: `[${ticket.severity.toUpperCase()}][${ticket.tier}] ${ticket.subject}`,
          html: renderTicketHtml(ticket),
          text: renderTicketText(ticket),
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        outcome.errors.push(`email: Resend ${res.status} ${body.slice(0, 200)}`)
      } else {
        outcome.emailed = true
      }
    } catch (e: any) {
      outcome.errors.push(`email: ${e?.message || 'Resend request failed'}`)
    }
  } else {
    outcome.errors.push('email: RESEND_API_KEY not configured')
  }

  // 3) Priority-tier: also notify Slack if a webhook is set.
  const slackWebhook = process.env.SUPPORT_SLACK_WEBHOOK_URL
  if (slackWebhook && ticket.tier === 'premium_plus') {
    try {
      const res = await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:
            `:rotating_light: *Priority ticket* from ${ticket.email || 'anonymous'}\n` +
            `*${ticket.subject}* (severity: ${ticket.severity})\n\n` +
            `${ticket.message}`,
        }),
      })
      if (res.ok) outcome.slacked = true
      else outcome.errors.push(`slack: ${res.status}`)
    } catch (e: any) {
      outcome.errors.push(`slack: ${e?.message || 'request failed'}`)
    }
  }

  const delivered = outcome.persisted || outcome.emailed || outcome.slacked
  return NextResponse.json(
    {
      success: delivered,
      ...outcome,
    },
    { status: delivered ? 200 : 502 },
  )
}

function renderTicketHtml(t: Record<string, any>) {
  const esc = (s: string) =>
    String(s || '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    )
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">New support ticket</h2>
      <p style="margin:0 0 16px;color:#555">
        <strong>From:</strong> ${esc(t.email || 'anonymous')}${t.name ? ` (${esc(t.name)})` : ''}<br/>
        <strong>Tier:</strong> ${esc(t.tier)} · <strong>Severity:</strong> ${esc(t.severity)}<br/>
        <strong>Ticket ID:</strong> ${esc(t.id)}
      </p>
      <h3 style="margin:16px 0 8px">${esc(t.subject)}</h3>
      <div style="white-space:pre-wrap;background:#f5f5f5;border:1px solid #eee;border-radius:8px;padding:16px">${esc(t.message)}</div>
      <p style="margin-top:24px;color:#888;font-size:12px">Submitted at ${esc(t.created_at)}</p>
    </div>
  `
}

function renderTicketText(t: Record<string, any>) {
  return [
    `New support ticket`,
    `From: ${t.email || 'anonymous'}${t.name ? ` (${t.name})` : ''}`,
    `Tier: ${t.tier} · Severity: ${t.severity}`,
    `Ticket ID: ${t.id}`,
    '',
    `Subject: ${t.subject}`,
    '',
    t.message,
    '',
    `Submitted at ${t.created_at}`,
  ].join('\n')
}
