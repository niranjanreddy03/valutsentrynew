import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      hasRazorpayKeyId: !!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      hasRazorpaySecret: !!process.env.RAZORPAY_KEY_SECRET,
      hasRazorpayWebhookSecret: !!process.env.RAZORPAY_WEBHOOK_SECRET,
      hasRazorpaySubscriptionPlans: Boolean(
        process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY &&
        process.env.RAZORPAY_PLAN_PREMIUM_YEARLY &&
        process.env.RAZORPAY_PLAN_PREMIUM_PLUS_MONTHLY &&
        process.env.RAZORPAY_PLAN_PREMIUM_PLUS_YEARLY,
      ),
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
    },
  })
}
