import { NextResponse } from 'next/server'
import {
  supabaseAdmin,
  verifyPaymentSignature,
} from '@/lib/razorpay/server'
import {
  isCycle,
  isPaidTier,
  getPlanPrice,
  type BillingCycle,
  type PaidTier,
} from '@/lib/razorpay/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAN_DURATION_DAYS = 30
const PLAN_DURATION_MS = PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000

interface BillingInfo {
  fullName: string
  address: string
  city: string
  state: string
  zip: string
  country: string
}

/**
 * POST /api/razorpay/verify
 * Body: {
 *   razorpay_order_id, razorpay_payment_id, razorpay_signature,
 *   tier, cycle, billing
 * }
 *
 * Verifies the HMAC-SHA256 signature returned by Razorpay Checkout and,
 * on success, promotes the user in Supabase, then sends an invoice email.
 */
export async function POST(req: Request) {
  try {
    const userId = req.headers.get('x-user-id')
    const userEmail = req.headers.get('x-user-email') || ''

    if (!userId || userId === 'local-user') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const orderId = String(body.razorpay_order_id ?? '')
    const paymentId = String(body.razorpay_payment_id ?? '')
    const signature = String(body.razorpay_signature ?? '')
    const tier = body.tier as PaidTier
    const cycle = body.cycle as BillingCycle
    const billing = (body.billing ?? {}) as Partial<BillingInfo>

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }
    if (!isPaidTier(tier) || !isCycle(cycle)) {
      return NextResponse.json({ error: 'Invalid tier or cycle' }, { status: 400 })
    }

    const ok = verifyPaymentSignature({ orderId, paymentId, signature })
    if (!ok) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 })
    }

    // All plans last exactly 30 days then auto-cancel.
    const now = new Date()
    const expiresAt = new Date(now.getTime() + PLAN_DURATION_MS)
    const price = getPlanPrice(tier, cycle)

    // Persist via service-role client (bypasses RLS).
    let serverUpdated = false
    try {
      const admin = supabaseAdmin()
      const { error: updateErr } = await admin
        .from('users')
        .update({
          subscription_tier: tier,
          subscription_started_at: now.toISOString(),
          subscription_expires_at: expiresAt.toISOString(),
          is_trial: false,
          trial_ends_at: null,
          updated_at: now.toISOString(),
        })
        .eq('id', userId)

      if (updateErr) {
        console.error('[razorpay] failed to promote user after payment:', updateErr)
      } else {
        serverUpdated = true
      }
    } catch (err) {
      console.error('[razorpay] supabaseAdmin error:', err)
    }

    // Send invoice email (best-effort — don't fail the payment over it).
    let invoiceSent = false
    if (userEmail) {
      try {
        await sendInvoiceEmail({
          to: userEmail,
          customerName: billing.fullName || userEmail,
          billing,
          planName: tier === 'premium' ? 'Professional' : 'Enterprise',
          tier,
          cycle,
          amount: price.amountMajor,
          currency: price.currency,
          paymentId,
          orderId,
          paidAt: now,
          expiresAt,
        })
        invoiceSent = true
      } catch (err) {
        console.error('[razorpay] invoice email failed:', err)
      }
    }

    return NextResponse.json({
      ok: true,
      tier,
      cycle,
      subscriptionExpiresAt: expiresAt.toISOString(),
      serverUpdated,
      invoiceSent,
    })
  } catch (err: any) {
    console.error('[razorpay] verify failed:', err)
    return NextResponse.json(
      { error: err?.message || 'Verification failed' },
      { status: 500 },
    )
  }
}

/* ------------------------------------------------------------------ */
/*  Invoice email via Resend                                           */
/* ------------------------------------------------------------------ */

async function sendInvoiceEmail(params: {
  to: string
  customerName: string
  billing: Partial<BillingInfo>
  planName: string
  tier: string
  cycle: string
  amount: number
  currency: string
  paymentId: string
  orderId: string
  paidAt: Date
  expiresAt: Date
}) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const fromAddress =
    process.env.INVOICE_FROM_ADDRESS || 'VaultSentry <billing@thevaultsentry.com>'
  const symbol = params.currency === 'INR' ? '₹' : params.currency === 'USD' ? '$' : ''
  const amountStr = `${symbol}${params.amount.toLocaleString()}`
  const paidDate = params.paidAt.toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const expiresDate = params.expiresAt.toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const invoiceNo = `VS-${params.paidAt.getFullYear()}${String(params.paidAt.getMonth() + 1).padStart(2, '0')}${String(params.paidAt.getDate()).padStart(2, '0')}-${params.paymentId.slice(-6).toUpperCase()}`

  const b = params.billing
  const billingBlock = [b.fullName, b.address, [b.city, b.state, b.zip].filter(Boolean).join(', '), b.country].filter(Boolean).join('<br/>')

  const esc = (s: string) =>
    String(s || '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#111;background:#fff">
  <div style="border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px">
    <h1 style="margin:0;font-size:20px;color:#2563eb">VaultSentry</h1>
    <p style="margin:4px 0 0;color:#666;font-size:13px">Payment Invoice</p>
  </div>

  <table style="width:100%;font-size:13px;margin-bottom:24px" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:4px 0;color:#888">Invoice #</td>
      <td style="padding:4px 0;text-align:right;font-weight:600">${esc(invoiceNo)}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#888">Date</td>
      <td style="padding:4px 0;text-align:right">${esc(paidDate)}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#888">Payment ID</td>
      <td style="padding:4px 0;text-align:right;font-family:monospace;font-size:12px">${esc(params.paymentId)}</td>
    </tr>
  </table>

  <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:24px">
    <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Bill to</p>
    <p style="margin:0;font-size:13px;line-height:1.6">${billingBlock || esc(params.customerName)}</p>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
    <thead>
      <tr style="border-bottom:1px solid #e5e7eb">
        <th style="padding:8px 0;text-align:left;color:#888;font-weight:500">Description</th>
        <th style="padding:8px 0;text-align:right;color:#888;font-weight:500">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:12px 0">
          <strong>${esc(params.planName)} Plan</strong><br/>
          <span style="color:#888;font-size:12px">${esc(params.cycle)} &middot; Valid until ${esc(expiresDate)}</span>
        </td>
        <td style="padding:12px 0;text-align:right;font-weight:600;font-size:15px">${esc(amountStr)}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td style="padding:12px 0;text-align:right;font-weight:600;color:#888">Total Paid</td>
        <td style="padding:12px 0;text-align:right;font-weight:700;font-size:16px;color:#2563eb">${esc(amountStr)}</td>
      </tr>
    </tfoot>
  </table>

  <div style="background:#eff6ff;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:12px;color:#1e40af">
    Your plan is active for <strong>${PLAN_DURATION_DAYS} days</strong> (until ${esc(expiresDate)}). After this period, your subscription will automatically revert to the Starter plan unless renewed.
  </div>

  <p style="color:#888;font-size:11px;text-align:center;margin-top:32px">
    VaultSentry &middot; www.thevaultsentry.com<br/>
    Questions? Contact support@thevaultsentry.com
  </p>
</div>`

  const text = [
    `VAULTSENTRY — PAYMENT INVOICE`,
    `Invoice: ${invoiceNo}`,
    `Date: ${paidDate}`,
    `Payment ID: ${params.paymentId}`,
    '',
    `Bill to: ${params.customerName}`,
    billingBlock ? billingBlock.replace(/<br\/>/g, ', ') : '',
    '',
    `${params.planName} Plan (${params.cycle})`,
    `Amount: ${amountStr}`,
    `Valid until: ${expiresDate} (${PLAN_DURATION_DAYS} days)`,
    '',
    `Your plan will automatically revert to Starter after ${expiresDate} unless renewed.`,
    '',
    `Questions? Contact support@thevaultsentry.com`,
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [params.to],
      subject: `VaultSentry Invoice ${invoiceNo} — ${params.planName} Plan`,
      html,
      text,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${errText.slice(0, 200)}`)
  }
}
