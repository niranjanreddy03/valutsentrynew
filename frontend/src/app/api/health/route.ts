import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      hasRazorpayKeyId: !!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      hasRazorpaySecret: !!process.env.RAZORPAY_KEY_SECRET,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
    },
  })
}
