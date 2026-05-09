import { NextResponse } from 'next/server'
import { createRazorpayOrder } from '@/lib/razorpay/server'
import {
  getPlanPrice,
  isCycle,
  isPaidTier,
  type BillingCycle,
  type PaidTier,
} from '@/lib/razorpay/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/razorpay/create-order
 * Body: { tier: 'premium'|'premium_plus', cycle: 'monthly'|'yearly' }
 *
 * Creates a Razorpay order server-side (amount authored here, NOT from the
 * client) and returns the order id + public key. The browser then opens
 * Razorpay Checkout with these values.
 */
export async function POST(req: Request) {
  try {
    // Authenticate via headers sent by getAuthHeaders() on the client.
    // Server-side cookie auth doesn't work on Amplify serverless.
    const userId = req.headers.get('x-user-id')
    const userEmail = req.headers.get('x-user-email') || ''

    if (!userId || userId === 'local-user') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body: { tier?: unknown; cycle?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const tier = body.tier as PaidTier
    const cycle = body.cycle as BillingCycle
    if (!isPaidTier(tier) || !isCycle(cycle)) {
      return NextResponse.json(
        { error: 'Invalid tier or billing cycle' },
        { status: 400 },
      )
    }

    const price = getPlanPrice(tier, cycle)

    const order = await createRazorpayOrder({
      amount: price.amountMinor,
      currency: price.currency,
      receipt: `vs_${userId.slice(0, 8)}_${Date.now().toString(36)}`.slice(0, 40),
      notes: {
        user_id: userId,
        email: userEmail,
        tier,
        cycle,
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      tier,
      cycle,
      displayAmount: price.amountMajor,
    })
  } catch (err: any) {
    console.error('[razorpay] create-order failed:', err)
    return NextResponse.json(
      { error: err?.message || 'Could not create payment order' },
      { status: 502 },
    )
  }
}
