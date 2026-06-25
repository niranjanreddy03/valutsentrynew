import { mkdir, readFile, writeFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { requireVerifiedUser } from '@/lib/serverSecurity'

export type Provider = 'github' | 'gitlab'

type StoredToken = {
  token: string
  username?: string
  added_at: string
}

type TokenStore = Record<string, Partial<Record<Provider, StoredToken>>>

const STORE_PATH = path.join(process.cwd(), '.user_integration_tokens.json')

function encryptionKey() {
  const secret = process.env.INTEGRATION_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('INTEGRATION_TOKEN_SECRET is required in production')
  }
  return crypto
    .createHash('sha256')
    .update(secret || 'vaultsentry-local-dev')
    .digest()
}

export async function userIdFrom(request: Request): Promise<string> {
  const auth = await requireVerifiedUser(request)
  if (!auth.ok) throw new Error('Not authenticated')
  return auth.user.id
}

export async function readStore(): Promise<TokenStore> {
  try {
    return JSON.parse(await readFile(STORE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

export async function writeStore(store: TokenStore) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true })
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 })
}

export function encrypt(value: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(value: string): string {
  const raw = Buffer.from(value, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export async function getStoredToken(request: Request, provider: Provider) {
  const store = await readStore()
  return store[await userIdFrom(request)]?.[provider]
}

export async function saveStoredToken(
  request: Request,
  provider: Provider,
  token: string,
  username?: string,
) {
  const store = await readStore()
  const userId = await userIdFrom(request)
  store[userId] ||= {}
  store[userId][provider] = {
    token: encrypt(token),
    username,
    added_at: new Date().toISOString(),
  }
  await writeStore(store)
  return store[userId][provider]
}

export async function deleteStoredToken(request: Request, provider: Provider) {
  const store = await readStore()
  const userId = await userIdFrom(request)
  if (store[userId]) {
    delete store[userId][provider]
    await writeStore(store)
  }
}

export async function validateGitHubToken(token: string) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  const data = await response.json().catch(() => ({}))
  const scopes = (response.headers.get('x-oauth-scopes') || '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)

  if (!response.ok) {
    return {
      valid: false,
      status: response.status === 401 ? 'invalid' : 'error',
      error_message: data?.message || `GitHub responded ${response.status}`,
      scopes,
    }
  }

  return {
    valid: true,
    status: 'valid',
    username: data?.login,
    scopes,
  }
}
