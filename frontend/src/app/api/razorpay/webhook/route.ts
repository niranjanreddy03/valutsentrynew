import { NextResponse } from 'next/server'
import {
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

/**
 * POST /api/razorpay/webhook
 *
 * Safety net for the Checkout callback. If the browser closes before
 * /api/razorpay/verify runs (network drop, tab close), Razorpay still
 * delivers `payment.captured` here and we can promote the user.
 *
 * The user id + tier + cycle ride along on the order's `notes` field
 * (we set them in /create-order). Webhook signature is verified against
 * the raw body — do not parse before verifying.
 */
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

  // We only act on successful captures. Failures just acknowledge 200 so
  // Razorpay stops retrying — they're reflected in the dashboard.
  if (event?.event !== 'payment.captured') {
    return NextResponse.json({ ok: true, ignored: event?.event })
  }

  const payment = event?.payload?.payment?.entity
  const notes = payment?.notes ?? {}
  const userId = typeof notes.user_id === 'string' ? notes.user_id : null
  const tier = notes.tier as PaidTier
  const cycle = notes.cycle as BillingCycle

  if (!userId || !isPaidTier(tier) || !isCycle(cycle)) {
    // Signed but unrecognisable — log and 200 so Razorpay stops retrying.
    console.warn('[razorpay] webhook captured without usable notes:', notes)
    return NextResponse.json({ ok: true, noted: false })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + cycleDurationMs(cycle))

  const { error } = await supabaseAdmin()
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

  if (error) {
    console.error('[razorpay] webhook tier-update failed:', error)
    // Return 500 so Razorpay retries.
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
