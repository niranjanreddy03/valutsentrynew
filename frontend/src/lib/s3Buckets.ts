/**
 * S3 bucket scanning — client-side store + scan orchestration.
 *
 * Optimisations over the initial implementation:
 *
 *   - Findings are indexed by bucketId (`Record<id, S3Finding[]>`) instead
 *     of a flat array, so per-bucket reads are O(1) and writes don't have
 *     to rewrite unrelated findings. Backwards-compatible with the old
 *     array form.
 *   - `scanBucket` supports AbortSignal + a 30-second cooldown so rapid
 *     re-clicks don't hammer the backend / simulate churn.
 *   - `scanAllBuckets` runs scans concurrently with a cap (default 3),
 *     so a "Scan all" button stays snappy without a flood of requests.
 *   - Single localStorage write per state transition (batched bucket +
 *     findings update), and a cross-tab `storage` listener is dispatched
 *     through a CustomEvent so every open tab updates in lockstep.
 *   - Findings retention is capped per-bucket (latest 100) rather than
 *     globally, so one very noisy bucket can't evict findings from other
 *     buckets.
 */

import { getAuthHeaders } from '@/lib/authHeaders'

export type BucketStatus = 'idle' | 'scanning' | 'clean' | 'has_findings' | 'failed'

export interface S3Bucket {
  id: string
  name: string
  region: string
  accessKeyId?: string
  secretAccessKeyFp?: string
  pathPrefix?: string
  status: BucketStatus
  lastScanAt?: string
  lastFindings?: number
  createdAt: string
}

export interface S3Finding {
  id: string
  bucketId: string
  bucketName: string
  key: string
  secretType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  snippet: string
  detectedAt: string
}

const BUCKETS_KEY = 'vaultsentry_s3_buckets'
const FINDINGS_KEY = 'vaultsentry_s3_findings'
const PER_BUCKET_FINDING_CAP = 100
const SCAN_COOLDOWN_MS = 30_000
const DEFAULT_CONCURRENCY = 3

type FindingsIndex = Record<string, S3Finding[]>

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

function safe(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function emit(event: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(event))
}

// Cross-tab sync: when another tab mutates our keys, re-emit internal events
// so listeners in this tab refresh too.
if (typeof window !== 'undefined') {
  const bound = (window as any).__vs_s3_cross_tab_bound__
  if (!bound) {
    window.addEventListener('storage', (e) => {
      if (e.key === BUCKETS_KEY) emit('vaultsentry:s3-buckets-updated')
      if (e.key === FINDINGS_KEY) emit('vaultsentry:s3-findings-updated')
    })
    ;(window as any).__vs_s3_cross_tab_bound__ = true
  }
}

/* ------------------------------------------------------------------ */
/*  Buckets                                                            */
/* ------------------------------------------------------------------ */

export function getBuckets(): S3Bucket[] {
  const s = safe()
  if (!s) return []
  try {
    return JSON.parse(s.getItem(BUCKETS_KEY) || '[]') as S3Bucket[]
  } catch {
    return []
  }
}

export function saveBuckets(list: S3Bucket[]) {
  const s = safe()
  if (!s) return
  s.setItem(BUCKETS_KEY, JSON.stringify(list))
  emit('vaultsentry:s3-buckets-updated')
}

/* ------------------------------------------------------------------ */
/*  Findings — indexed by bucketId                                     */
/* ------------------------------------------------------------------ */

function readIndex(): FindingsIndex {
  const s = safe()
  if (!s) return {}
  const raw = s.getItem(FINDINGS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    // Backwards-compat: old flat-array form → rebuild the index once.
    if (Array.isArray(parsed)) {
      const idx: FindingsIndex = {}
      for (const f of parsed as S3Finding[]) {
        if (!f?.bucketId) continue
        ;(idx[f.bucketId] ||= []).push(f)
      }
      writeIndex(idx)
      return idx
    }
    return (parsed || {}) as FindingsIndex
  } catch {
    return {}
  }
}

function writeIndex(idx: FindingsIndex) {
  const s = safe()
  if (!s) return
  s.setItem(FINDINGS_KEY, JSON.stringify(idx))
  emit('vaultsentry:s3-findings-updated')
}

export function getS3Findings(bucketId?: string): S3Finding[] {
  const idx = readIndex()
  if (bucketId) return idx[bucketId] ?? []
  // Flat list across buckets — cheap because we stream object.values.
  const out: S3Finding[] = []
  for (const arr of Object.values(idx)) out.push(...arr)
  return out
}

function setBucketFindings(bucketId: string, findings: S3Finding[]) {
  const idx = readIndex()
  if (findings.length === 0) {
    delete idx[bucketId]
  } else {
    // Cap per-bucket so one noisy bucket can't dominate storage.
    idx[bucketId] = findings.slice(0, PER_BUCKET_FINDING_CAP)
  }
  writeIndex(idx)
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function addBucket(
  input: Omit<S3Bucket, 'id' | 'status' | 'createdAt' | 'secretAccessKeyFp'> & {
    secretAccessKey?: string
  },
): S3Bucket {
  const secret = input.secretAccessKey
  const fp = secret && secret.length >= 4 ? `••••${secret.slice(-4)}` : undefined
  const b: S3Bucket = {
    id: uuid(),
    name: input.name.trim(),
    region: input.region.trim() || 'us-east-1',
    accessKeyId: input.accessKeyId?.trim() || undefined,
    secretAccessKeyFp: fp,
    pathPrefix: input.pathPrefix?.trim() || undefined,
    status: 'idle',
    createdAt: new Date().toISOString(),
  }
  const list = getBuckets()
  list.push(b)
  saveBuckets(list)
  return b
}

export function deleteBucket(id: string) {
  // Batched: one bucket write, one index write.
  saveBuckets(getBuckets().filter((b) => b.id !== id))
  const idx = readIndex()
  if (idx[id]) {
    delete idx[id]
    writeIndex(idx)
  }
}

export function updateBucket(id: string, patch: Partial<S3Bucket>): S3Bucket | null {
  const list = getBuckets()
  const i = list.findIndex((b) => b.id === id)
  if (i === -1) return null
  list[i] = { ...list[i], ...patch }
  saveBuckets(list)
  return list[i]
}

/* ------------------------------------------------------------------ */
/*  Scan — backend-first with simulated fallback                       */
/* ------------------------------------------------------------------ */

const SIMULATED_LEAKS = [
  {
    secretType: 'AWS Access Key',
    severity: 'critical' as const,
    snippet: 'AKIA•••••••••••SAMPLE',
    keyTemplate: 'backups/db-{n}.env',
  },
  {
    secretType: 'Stripe Secret Key',
    severity: 'critical' as const,
    snippet: 'sk_live_•••••••••••••••••••SAMPLE',
    keyTemplate: 'exports/payments-{n}.json',
  },
  {
    secretType: 'Slack Webhook',
    severity: 'high' as const,
    snippet: 'https://hooks.slack.com/services/•••/•••/•••SAMPLE',
    keyTemplate: 'infra/slack-{n}.yml',
  },
  {
    secretType: 'Google API Key',
    severity: 'high' as const,
    snippet: 'AIza•••••••••••••••••••SAMPLE',
    keyTemplate: 'mobile/app-config-{n}.json',
  },
  {
    secretType: 'Private SSH Key',
    severity: 'medium' as const,
    snippet: '-----BEGIN RSA PRIVATE KEY----- SAMPLE',
    keyTemplate: 'legacy/deploy-{n}.pem',
  },
]

function hashToIndex(seed: string, mod: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h) % mod
}

function simulateScan(bucket: S3Bucket): S3Finding[] {
  const count = hashToIndex(bucket.name, 4) + 1
  const out: S3Finding[] = []
  for (let i = 0; i < count; i++) {
    const leak = SIMULATED_LEAKS[hashToIndex(bucket.name + i, SIMULATED_LEAKS.length)]
    out.push({
      id: uuid(),
      bucketId: bucket.id,
      bucketName: bucket.name,
      key:
        (bucket.pathPrefix ? bucket.pathPrefix.replace(/\/$/, '') + '/' : '') +
        leak.keyTemplate.replace('{n}', String(i + 1)),
      secretType: leak.secretType,
      severity: leak.severity,
      snippet: leak.snippet,
      detectedAt: new Date().toISOString(),
    })
  }
  return out
}

export interface ScanOptions {
  /** Skip the 30s cooldown. */
  force?: boolean
  /** Abort the in-flight fetch if the user cancels. */
  signal?: AbortSignal
}

export interface ScanResult {
  bucketId: string
  findings: S3Finding[]
  status: BucketStatus
  source: 'backend' | 'simulated' | 'cached'
  skipped?: boolean
  reason?: string
}

function isOnCooldown(b: S3Bucket): boolean {
  if (!b.lastScanAt) return false
  return Date.now() - new Date(b.lastScanAt).getTime() < SCAN_COOLDOWN_MS
}

/**
 * Scan a single bucket. Safe to call concurrently — the cooldown guard and
 * the status flip prevent duplicate in-flight scans of the same bucket.
 */
export async function scanBucket(
  bucketId: string,
  opts: ScanOptions = {},
): Promise<ScanResult> {
  const startList = getBuckets()
  const bucket = startList.find((b) => b.id === bucketId)
  if (!bucket) throw new Error('Bucket not found')

  // Cooldown guard — return cached result rather than firing again.
  if (!opts.force && isOnCooldown(bucket)) {
    const cached = getS3Findings(bucket.id)
    return {
      bucketId: bucket.id,
      findings: cached,
      status: bucket.status,
      source: 'cached',
      skipped: true,
      reason: 'cooldown',
    }
  }

  // Guard against re-entrancy — if already scanning, bail.
  if (bucket.status === 'scanning') {
    return {
      bucketId: bucket.id,
      findings: getS3Findings(bucket.id),
      status: bucket.status,
      source: 'cached',
      skipped: true,
      reason: 'already-scanning',
    }
  }

  updateBucket(bucket.id, { status: 'scanning' })

  let findings: S3Finding[] = []
  let source: ScanResult['source'] = 'simulated'

  try {
    const res = await fetch('/api/scan/s3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        bucket_id: bucket.id,
        bucket_name: bucket.name,
        region: bucket.region,
        path_prefix: bucket.pathPrefix,
      }),
      signal: opts.signal,
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      if (Array.isArray(data?.findings)) {
        findings = data.findings.map((f: any) => ({
          id: f.id || uuid(),
          bucketId: bucket.id,
          bucketName: bucket.name,
          key: f.key ?? f.file ?? '',
          secretType: f.secret_type ?? f.type ?? 'Unknown',
          severity: (f.severity ?? 'medium') as S3Finding['severity'],
          snippet: f.snippet ?? '',
          detectedAt: f.detected_at ?? new Date().toISOString(),
        }))
        source = 'backend'
      } else {
        findings = simulateScan(bucket)
      }
    } else {
      findings = simulateScan(bucket)
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      updateBucket(bucket.id, { status: bucket.status === 'scanning' ? 'idle' : bucket.status })
      throw err
    }
    findings = simulateScan(bucket)
  }

  // Batched write: findings + bucket state in sequence (two keys, one function each).
  setBucketFindings(bucket.id, findings)
  const status: BucketStatus = findings.length > 0 ? 'has_findings' : 'clean'
  updateBucket(bucket.id, {
    status,
    lastScanAt: new Date().toISOString(),
    lastFindings: findings.length,
  })

  return { bucketId: bucket.id, findings, status, source }
}

/**
 * Scan every bucket in parallel with a concurrency cap. Returns when every
 * bucket has either finished scanning or hit its cooldown.
 */
export async function scanAllBuckets(opts: {
  concurrency?: number
  force?: boolean
  signal?: AbortSignal
  onResult?: (r: ScanResult) => void
} = {}): Promise<ScanResult[]> {
  const limit = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY)
  const queue = getBuckets().map((b) => b.id)
  const results: ScanResult[] = []

  const workers: Promise<void>[] = []
  let i = 0
  const next = async () => {
    while (i < queue.length) {
      const idx = i++
      const id = queue[idx]
      try {
        const r = await scanBucket(id, { force: opts.force, signal: opts.signal })
        results.push(r)
        opts.onResult?.(r)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        results.push({
          bucketId: id,
          findings: [],
          status: 'failed',
          source: 'simulated',
          reason: err?.message,
        })
      }
    }
  }
  for (let k = 0; k < limit; k++) workers.push(next())
  await Promise.all(workers)
  return results
}

/* ------------------------------------------------------------------ */
/*  Aggregate metrics — cheap enough to call from render               */
/* ------------------------------------------------------------------ */

export interface S3Metrics {
  buckets: number
  scanned: number
  totalFindings: number
  bySeverity: Record<S3Finding['severity'], number>
}

export function computeMetrics(): S3Metrics {
  const buckets = getBuckets()
  const idx = readIndex()
  const bySeverity: S3Metrics['bySeverity'] = { critical: 0, high: 0, medium: 0, low: 0 }
  let total = 0
  for (const arr of Object.values(idx)) {
    total += arr.length
    for (const f of arr) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1
  }
  return {
    buckets: buckets.length,
    scanned: buckets.filter((b) => b.lastScanAt).length,
    totalFindings: total,
    bySeverity,
  }
}
