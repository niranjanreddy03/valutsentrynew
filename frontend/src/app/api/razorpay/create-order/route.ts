import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/razorpay/create-order
 * Body: { tier: 'premium'|'premium_plus', cycle: 'monthly'|'yearly' }
 *
 * Completely self-contained — no external imports that could crash Lambda.
 */

const PRICES: Record<string, Record<string, { amount: number; currency: string }>> = {
  premium:      { monthly: { amount: 29900,  currency: 'INR' }, yearly: { amount: 299000,  currency: 'INR' } },
  premium_plus: { monthly: { amount: 99900,  currency: 'INR' }, yearly: { amount: 999000,  currency: 'INR' } },
}

const DISPLAY: Record<string, Record<string, number>> = {
  premium:      { monthly: 299,  yearly: 2990 },
  premium_plus: { monthly: 999,  yearly: 9990 },
}

export async function POST(req: Request) {
  try {
    const userId = req.headers.get('x-user-id')
    const userEmail = req.headers.get('x-user-email') || ''

    if (!userId || userId === 'local-user') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const tier = String(body.tier || '')
    const cycle = String(body.cycle || '')

    if (!['premium', 'premium_plus'].includes(tier) || !['monthly', 'yearly'].includes(cycle)) {
      return NextResponse.json({ error: 'Invalid tier or billing cycle' }, { status: 400 })
    }

    const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const key_secret = process.env.RAZORPAY_KEY_SECRET

    if (!key_id || !key_secret) {
      console.error('[razorpay] NEXT_PUBLIC_RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set')
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 })
    }

    const price = PRICES[tier][cycle]
    const auth = 'Basic ' + Buffer.from(`${key_id}:${key_secret}`).toString('base64')

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({
        amount: price.amount,
        currency: price.currency,
        receipt: `vs_${userId.slice(0, 8)}_${Date.now().toString(36)}`.slice(0, 40),
        notes: { user_id: userId, email: userEmail, tier, cycle },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[razorpay] Razorpay API error:', res.status, errText)
      return NextResponse.json({ error: 'Razorpay order creation failed' }, { status: 502 })
    }

    const order = await res.json()

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: key_id,
      tier,
      cycle,
      displayAmount: DISPLAY[tier][cycle],
    })
  } catch (err: any) {
    console.error('[razorpay] create-order crashed:', err?.message || err)
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
