import { NextResponse } from 'next/server'
import {
  supabaseAdmin,
  verifyPaymentSignature,
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
 * POST /api/razorpay/verify
 * Body: {
 *   razorpay_order_id, razorpay_payment_id, razorpay_signature,
 *   tier, cycle
 * }
 *
 * Verifies the HMAC-SHA256 signature returned by Razorpay Checkout and,
 * on success, promotes the user in Supabase.
 */
export async function POST(req: Request) {
  try {
    // Authenticate via headers sent by getAuthHeaders() on the client.
    // Server-side cookie auth doesn't work on Amplify serverless.
    const userId = req.headers.get('x-user-id')

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

    // Signature matched — promote the user.
    const now = new Date()
    const expiresAt = new Date(now.getTime() + cycleDurationMs(cycle))

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
      // Don't fail — client will sync via updateProfile
    }

    return NextResponse.json({
      ok: true,
      tier,
      cycle,
      subscriptionExpiresAt: expiresAt.toISOString(),
      serverUpdated,
    })
  } catch (err: any) {
    console.error('[razorpay] verify failed:', err)
    return NextResponse.json(
      { error: err?.message || 'Verification failed' },
      { status: 500 },
    )
  }
}
