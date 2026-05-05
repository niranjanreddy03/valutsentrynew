import { mkdir, readFile, writeFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'

export type Provider = 'github' | 'gitlab'

type StoredToken = {
  token: string
  username?: string
  added_at: string
}

type TokenStore = Record<string, Partial<Record<Provider, StoredToken>>>

const STORE_PATH = path.join(process.cwd(), '.user_integration_tokens.json')
const KEY = crypto
  .createHash('sha256')
  .update(process.env.INTEGRATION_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || 'vaultsentry-local-dev')
  .digest()

export function userIdFrom(request: Request): string {
  return request.headers.get('x-user-id') || 'local-user'
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
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
}

export function encrypt(value: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(value: string): string {
  const raw = Buffer.from(value, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export async function getStoredToken(request: Request, provider: Provider) {
  const store = await readStore()
  return store[userIdFrom(request)]?.[provider]
}

export async function saveStoredToken(
  request: Request,
  provider: Provider,
  token: string,
  username?: string,
) {
  const store = await readStore()
  const userId = userIdFrom(request)
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
  const userId = userIdFrom(request)
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
