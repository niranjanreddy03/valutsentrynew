const LOCAL_MFA_FACTORS_KEY = 'vs_local_mfa_factors'

interface LocalMfaFactor {
  secret: string
  issuer: string
  accountName: string
  verifiedAt: string
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function readFactors(): Record<string, LocalMfaFactor> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(LOCAL_MFA_FACTORS_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeFactors(factors: Record<string, LocalMfaFactor>) {
  localStorage.setItem(LOCAL_MFA_FACTORS_KEY, JSON.stringify(factors))
}

export function generateTotpSecret(length = 20): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let bits = ''
  bytes.forEach((byte) => {
    bits += byte.toString(2).padStart(8, '0')
  })

  let output = ''
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0')
    output += BASE32_ALPHABET[parseInt(chunk, 2)]
  }

  return output
}

export function buildOtpAuthUri(secret: string, accountName: string, issuer = 'VaultSentry') {
  const label = `${issuer}:${accountName}`
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}

function base32ToBytes(secret: string): Uint8Array {
  const clean = secret.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase()
  let bits = ''

  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char)
    if (value === -1) throw new Error('Invalid TOTP secret')
    bits += value.toString(2).padStart(5, '0')
  }

  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }

  return new Uint8Array(bytes)
}

async function generateTotpCode(secret: string, counter: number): Promise<string> {
  const secretBytes = base32ToBytes(secret)
  const secretBuffer = secretBytes.buffer.slice(
    secretBytes.byteOffset,
    secretBytes.byteOffset + secretBytes.byteLength,
  ) as ArrayBuffer
  const key = await crypto.subtle.importKey(
    'raw',
    secretBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )

  const counterBytes = new ArrayBuffer(8)
  const view = new DataView(counterBytes)
  view.setUint32(4, counter, false)

  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes))
  const offset = digest[digest.length - 1] & 0xf
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return String(binary % 1_000_000).padStart(6, '0')
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const normalized = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized)) return false

  const currentCounter = Math.floor(Date.now() / 1000 / 30)
  for (let offset = -1; offset <= 1; offset++) {
    if ((await generateTotpCode(secret, currentCounter + offset)) === normalized) {
      return true
    }
  }

  return false
}

export function saveLocalMfaFactor(userId: string, factor: LocalMfaFactor) {
  const factors = readFactors()
  factors[userId] = factor
  writeFactors(factors)
}

export function getLocalMfaFactor(userId?: string | null): LocalMfaFactor | null {
  if (!userId) return null
  return readFactors()[userId] ?? null
}

export function deleteLocalMfaFactor(userId?: string | null) {
  if (!userId) return
  const factors = readFactors()
  delete factors[userId]
  writeFactors(factors)
}
