import { NextResponse } from 'next/server'
import {
  fetchRazorpaySubscription,
  supabaseAdmin,
  verifyWebhookSignature,
} from '@/lib/razorpay/server'
import {
  cycleDurationMs,
  isCycle,
  isPaidTier,
  type BillingCycle,
  type PaidTier,
} from '@/lib/razorpay/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BILLING_EVENTS = new Set([
  'invoice.paid',
  'subscription.charged',
  'subscription.authenticated',
])

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  if (!verifyWebhookSignature({ rawBody, signature })) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!BILLING_EVENTS.has(event?.event)) {
    return NextResponse.json({ ok: true, ignored: event?.event })
  }

  const payload = event?.payload ?? {}
  const subscriptionEntity = payload.subscription?.entity
  const invoiceEntity = payload.invoice?.entity
  const paymentEntity = payload.payment?.entity

  const subscriptionId =
    subscriptionEntity?.id ||
    invoiceEntity?.subscription_id ||
    paymentEntity?.subscription_id

  if (!subscriptionId) {
    console.warn('[razorpay] billing webhook without subscription id:', event?.event)
    return NextResponse.json({ ok: true, noted: false })
  }

  const subscription = subscriptionEntity?.notes
    ? subscriptionEntity
    : await fetchRazorpaySubscription(subscriptionId)

  const notes = subscription?.notes ?? {}
  const userId = typeof notes.user_id === 'string' ? notes.user_id : null
  const tier = notes.tier as PaidTier
  const cycle = notes.cycle as BillingCycle

  if (!userId || !isPaidTier(tier) || !isCycle(cycle)) {
    console.warn('[razorpay] subscription webhook without usable notes:', {
      event: event?.event,
      subscriptionId,
      notes,
    })
    return NextResponse.json({ ok: true, noted: false })
  }

  const now = new Date()
  const currentStart = typeof subscription.current_start === 'number'
    ? new Date(subscription.current_start * 1000)
    : now
  const currentEnd = typeof subscription.current_end === 'number'
    ? new Date(subscription.current_end * 1000)
    : new Date(now.getTime() + cycleDurationMs(cycle))

  const { error } = await (supabaseAdmin() as any)
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_started_at: currentStart.toISOString(),
      subscription_expires_at: currentEnd.toISOString(),
      is_trial: false,
      trial_ends_at: null,
      updated_at: now.toISOString(),
    })
    .eq('id', userId)

  if (error) {
    console.error('[razorpay] webhook tier-update failed:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    event: event.event,
    subscriptionId,
    invoiceId: invoiceEntity?.id ?? null,
  })
}
