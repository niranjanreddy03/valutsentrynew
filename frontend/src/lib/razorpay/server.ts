import crypto from 'crypto'
import Razorpay from 'razorpay'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * Server-only Razorpay helpers. Do not import from client components.
 *
 * - razorpay(): returns a memoised Razorpay SDK instance.
 * - verifyPaymentSignature(): HMAC-SHA256 check for the Checkout callback.
 * - verifyWebhookSignature(): HMAC-SHA256 check for dashboard webhooks.
 * - supabaseAdmin(): service-role Supabase client used after a verified
 *   payment to update the user's subscription tier bypassing RLS.
 */

let _rzp: Razorpay | null = null
export function razorpay(): Razorpay {
  if (_rzp) return _rzp
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error(
      'Razorpay keys missing. Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
    )
  }
  _rzp = new Razorpay({ key_id, key_secret })
  return _rzp
}

export function verifyPaymentSignature(params: {
  orderId: string
  paymentId: string
  signature: string
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex')
  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(params.signature, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function verifyWebhookSignature(params: {
  rawBody: string
  signature: string | null
}): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !params.signature) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(params.rawBody)
    .digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(params.signature, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

let _admin: ReturnType<typeof createSupabaseAdminClient<Database>> | null = null
export function supabaseAdmin() {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase service role not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }
  _admin = createSupabaseAdminClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _admin
}
