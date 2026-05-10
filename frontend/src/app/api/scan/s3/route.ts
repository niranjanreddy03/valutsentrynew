import { NextResponse } from 'next/server'
import { guardFeature } from '@/lib/subscriptionGuard'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

function forwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  for (const key of ['x-user-id', 'x-user-email', 'x-user-name']) {
    const val = request.headers.get(key)
    if (val) headers[key] = val
  }
  if (!headers['x-user-id']) headers['x-user-id'] = 'local-user'
  return headers
}

// POST /api/scan/s3 → POST /api/v1/cloud/s3/scan
export async function POST(request: Request) {
  // S3 scanning requires premium_plus
  try {
    const guard = await guardFeature('aws_integration')
    if (!guard.allowed) {
      return NextResponse.json({ error: guard.error, upgrade: true }, { status: 403 })
    }
  } catch (err) {
    console.warn('[API /api/scan/s3] Subscription guard error, allowing through:', err)
  }

  try {
    const body = await request.json()

    // Map frontend payload to backend schema
    const backendPayload = {
      bucket_name: body.bucket_name ?? body.bucket_id ?? '',
      prefix: body.path_prefix ?? '',
      aws_access_key_id: body.access_key_id,
      aws_secret_access_key: body.secret_access_key,
      region: body.region ?? 'us-east-1',
      max_files: 200,
    }

    const response = await fetch(`${BACKEND_URL}/cloud/s3/scan`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(backendPayload),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    // Normalise backend response to the shape s3Buckets.ts expects:
    // { findings: S3Finding[] }
    const findings = (data.findings ?? []).map((f: any) => ({
      id: f.id ?? crypto.randomUUID(),
      key: f.file_path?.replace(/^s3:\/\/[^/]+\//, '') ?? f.file ?? '',
      secret_type: f.rule_id ?? f.secret_type ?? f.type ?? 'Unknown',
      severity: f.severity ?? 'medium',
      snippet: f.matched_value ?? f.snippet ?? '',
      detected_at: f.detected_at ?? new Date().toISOString(),
    }))

    return NextResponse.json({ findings })
  } catch (error) {
    console.error('[S3 SCAN PROXY] Failed to reach backend:', error)
    return NextResponse.json(
      { error: 'Scanner backend not reachable.' },
      { status: 502 },
    )
  }
}
