import { NextResponse } from 'next/server'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'

type IntegrationConfig = {
  slackWebhookUrl?: string
  genericWebhookUrl?: string
  jiraWebhookUrl?: string
  jiraProjectKey?: string
  mlRiskScoringEnabled?: boolean
}

const STORE_PATH = path.join(process.cwd(), '.user_integrations.json')

function userIdFrom(request: Request): string {
  return request.headers.get('x-user-id') || 'local-user'
}

async function readStore(): Promise<Record<string, IntegrationConfig>> {
  try {
    return JSON.parse(await readFile(STORE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

async function writeStore(store: Record<string, IntegrationConfig>) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true })
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
}

function normalizeConfig(input: any): IntegrationConfig {
  return {
    slackWebhookUrl: input?.slackWebhookUrl || undefined,
    genericWebhookUrl: input?.genericWebhookUrl || undefined,
    jiraWebhookUrl: input?.jiraWebhookUrl || undefined,
    jiraProjectKey: input?.jiraProjectKey || undefined,
    mlRiskScoringEnabled:
      typeof input?.mlRiskScoringEnabled === 'boolean'
        ? input.mlRiskScoringEnabled
        : undefined,
  }
}

export async function GET(request: Request) {
  const store = await readStore()
  return NextResponse.json(store[userIdFrom(request)] || {})
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const config = normalizeConfig(body)
  const store = await readStore()
  store[userIdFrom(request)] = config
  await writeStore(store)
  return NextResponse.json(config)
}
