import { NextResponse } from 'next/server'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  assertSameOrigin,
  readJsonBody,
  requireVerifiedUser,
} from '@/lib/serverSecurity'

export const runtime = 'nodejs'

type IntegrationConfig = {
  slackWebhookUrl?: string
  genericWebhookUrl?: string
  jiraWebhookUrl?: string
  jiraProjectKey?: string
  mlRiskScoringEnabled?: boolean
}

const STORE_PATH = path.join(process.cwd(), '.user_integrations.json')

async function readStore(): Promise<Record<string, IntegrationConfig>> {
  try {
    return JSON.parse(await readFile(STORE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

async function writeStore(store: Record<string, IntegrationConfig>) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true })
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 })
}

function safeHttpsUrl(value: unknown): string | undefined {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function normalizeConfig(input: any): IntegrationConfig | null {
  const config = {
    slackWebhookUrl: safeHttpsUrl(input?.slackWebhookUrl),
    genericWebhookUrl: safeHttpsUrl(input?.genericWebhookUrl),
    jiraWebhookUrl: safeHttpsUrl(input?.jiraWebhookUrl),
    jiraProjectKey: input?.jiraProjectKey
      ? String(input.jiraProjectKey).trim().slice(0, 32).replace(/[^A-Za-z0-9_-]/g, '')
      : undefined,
    mlRiskScoringEnabled:
      typeof input?.mlRiskScoringEnabled === 'boolean'
        ? input.mlRiskScoringEnabled
        : undefined,
  }

  const suppliedUrlInvalid = ['slackWebhookUrl', 'genericWebhookUrl', 'jiraWebhookUrl'].some(
    (key) => input?.[key] && !(config as any)[key],
  )
  return suppliedUrlInvalid ? null : config
}

export async function GET(request: Request) {
  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  const store = await readStore()
  return NextResponse.json(store[auth.user.id] || {})
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody(request, 32 * 1024)
  if (!parsed.ok) return parsed.response

  const config = normalizeConfig(parsed.data)
  if (!config) return NextResponse.json({ error: 'Webhook URLs must be HTTPS' }, { status: 400 })

  const store = await readStore()
  store[auth.user.id] = config
  await writeStore(store)
  return NextResponse.json(config)
}
