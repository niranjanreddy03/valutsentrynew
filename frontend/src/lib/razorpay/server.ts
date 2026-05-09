import crypto from 'crypto'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * Server-only Razorpay helpers — SDK-free.
 *
 * Uses Razorpay REST API directly via fetch so there's no third-party
 * package that can crash on Amplify's serverless Lambda.
 */

const RAZORPAY_API = 'https://api.razorpay.com/v1'

function razorpayAuth(): string {
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error('Payment gateway not configured. Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.')
  }
  return 'Basic ' + Buffer.from(`${key_id}:${key_secret}`).toString('base64')
}

/**
 * Create a Razorpay order via REST API.
 * Replaces razorpay SDK's orders.create().
 */
export async function createRazorpayOrder(params: {
  amount: number
  currency: string
  receipt: string
  notes: Record<string, string>
}): Promise<{ id: string; amount: number; currency: string }> {
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: razorpayAuth(),
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[razorpay] order creation failed:', res.status, err)
    throw new Error(`Razorpay API error: ${res.status}`)
  }

  return res.json()
}

/** Returns true if Razorpay keys are configured. */
export function isRazorpayConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
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
