/**
 * Cloudflare Turnstile siteverify helper.
 *
 * Returns { success: true } when TURNSTILE_SECRET_KEY is unset so local/dev
 * environments keep working without captcha. Production deploys must set the
 * secret for enforcement.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileResult {
  success: boolean
  errorCodes?: string[]
}

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { success: true }

  if (!token) return { success: false, errorCodes: ['missing-input-response'] }

  const body = new URLSearchParams()
  body.append('secret', secret)
  body.append('response', token)
  if (remoteIp) body.append('remoteip', remoteIp)

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = (await res.json()) as {
      success: boolean
      'error-codes'?: string[]
    }
    return { success: !!data.success, errorCodes: data['error-codes'] }
  } catch {
    return { success: false, errorCodes: ['siteverify-network-error'] }
  }
}

export function getClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return headers.get('cf-connecting-ip') || headers.get('x-real-ip') || null
}
