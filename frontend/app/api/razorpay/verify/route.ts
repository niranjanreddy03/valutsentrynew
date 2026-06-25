import { NextResponse } from 'next/server'
import {
  fetchRazorpaySubscription,
  supabaseAdmin,
  verifySubscriptionSignature,
} from '@/lib/razorpay/server'
import { assertSameOrigin, readJsonBody, requireVerifiedUser } from '@/lib/serverSecurity'
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
 * POST /api/razorpay/verify
 * Body: {
 *   razorpay_subscription_id, razorpay_payment_id, razorpay_signature,
 *   tier, cycle
 * }
 *
 * Verifies Razorpay Subscription Checkout and promotes the user. Razorpay
 * handles the subscription invoice email for successful charges.
 */
export async function POST(req: Request) {
  const origin = assertSameOrigin(req)
  if (origin) return origin

  const auth = await requireVerifiedUser(req)
  if (!auth.ok) return auth.response

  try {
    const userId = auth.user.id
    const parsed = await readJsonBody<any>(req)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const subscriptionId = String(body.razorpay_subscription_id ?? '')
    const paymentId = String(body.razorpay_payment_id ?? '')
    const signature = String(body.razorpay_signature ?? '')
    const tier = body.tier as PaidTier
    const cycle = body.cycle as BillingCycle

    if (!subscriptionId || !paymentId || !signature) {
      return NextResponse.json({ error: 'Missing subscription payment fields' }, { status: 400 })
    }
    if (!isPaidTier(tier) || !isCycle(cycle)) {
      return NextResponse.json({ error: 'Invalid tier or cycle' }, { status: 400 })
    }

    const ok = verifySubscriptionSignature({ subscriptionId, paymentId, signature })
    if (!ok) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 })
    }

    const subscription = await fetchRazorpaySubscription(subscriptionId)
    const notes = subscription.notes ?? {}
    if (notes.user_id && notes.user_id !== userId) {
      return NextResponse.json({ error: 'Subscription belongs to another user' }, { status: 403 })
    }

    const now = new Date()
    const currentEnd = typeof subscription.current_end === 'number'
      ? new Date(subscription.current_end * 1000)
      : new Date(now.getTime() + cycleDurationMs(cycle))

    const { error: updateErr } = await (supabaseAdmin() as any)
      .from('users')
      .update({
        subscription_tier: tier,
        subscription_started_at: now.toISOString(),
        subscription_expires_at: currentEnd.toISOString(),
        is_trial: false,
        trial_ends_at: null,
        updated_at: now.toISOString(),
      })
      .eq('id', userId)

    if (updateErr) {
      console.error('[razorpay] failed to promote user after subscription auth:', updateErr)
      return NextResponse.json({ error: 'Subscription saved at Razorpay but profile update failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      tier,
      cycle,
      subscriptionId,
      paymentId,
      razorpayStatus: subscription.status,
      subscriptionExpiresAt: currentEnd.toISOString(),
      invoiceHandledBy: 'razorpay',
    })
  } catch (err: any) {
    console.error('[razorpay] verify failed:', err)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 },
    )
  }
}
