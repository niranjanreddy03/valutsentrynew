import { NextResponse } from 'next/server'
import { rateLimitOrBlock } from '@/lib/rate-limit'
import {
  assertSameOrigin,
  authForwardHeaders,
  backendUrl,
  readJsonBody,
  requireVerifiedUser,
} from '@/lib/serverSecurity'

type S3ScanBody = {
  bucket_name?: string
  bucket_id?: string
  path_prefix?: string
  access_key_id?: string
  secret_access_key?: string
  region?: string
}

// POST /api/scan/s3 -> POST /api/v1/cloud/s3/scan
export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const blocked = rateLimitOrBlock(request, 'scan:s3', 3, 120_000)
  if (blocked) return blocked

  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<S3ScanBody>(request)
  if (!parsed.ok) return parsed.response

  try {
    const body = parsed.data
    const bucketName = String(body.bucket_name ?? body.bucket_id ?? '').trim()
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucketName)) {
      return NextResponse.json({ error: 'Invalid S3 bucket name' }, { status: 400 })
    }

    const backendPayload = {
      bucket_name: bucketName,
      prefix: String(body.path_prefix ?? '').slice(0, 1024),
      aws_access_key_id: String(body.access_key_id ?? ''),
      aws_secret_access_key: String(body.secret_access_key ?? ''),
      region: String(body.region ?? 'us-east-1'),
      max_files: 200,
    }

    const response = await fetch(backendUrl('/cloud/s3/scan'), {
      method: 'POST',
      headers: authForwardHeaders(auth.user),
      body: JSON.stringify(backendPayload),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

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
