'use client'

import FeatureGate from '@/components/FeatureGate'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useToast } from '@/contexts/ToastContext'
import {
  addBucket,
  computeMetrics,
  deleteBucket,
  getBuckets,
  getS3Findings,
  S3Bucket,
  S3Finding,
  scanAllBuckets,
  scanBucket,
} from '@/lib/s3Buckets'
import {
  AlertTriangle,
  Cloud,
  Database,
  Loader2,
  Plus,
  Radar,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
]

export default function S3BucketsPage() {
  const { showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [buckets, setBuckets] = useState<S3Bucket[]>([])
  const [viewingFindingsFor, setViewingFindingsFor] = useState<S3Bucket | null>(null)
  const [viewingFindings, setViewingFindings] = useState<S3Finding[]>([])
  const [metrics, setMetrics] = useState(() => ({
    buckets: 0,
    scanned: 0,
    totalFindings: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
  }))
  const [showNew, setShowNew] = useState(false)
  const [scanningIds, setScanningIds] = useState<Set<string>>(new Set())
  const [scanningAll, setScanningAll] = useState(false)
  const scanAbortRef = useRef<AbortController | null>(null)

  // new-bucket form state
  const [name, setName] = useState('')
  const [region, setRegion] = useState('us-east-1')
  const [accessKeyId, setAccessKeyId] = useState('')
  const [secretAccessKey, setSecretAccessKey] = useState('')
  const [pathPrefix, setPathPrefix] = useState('')

  // Debounced refresh — two storage events often land in the same tick
  // (bucket status + findings) so a single rAF coalesces them.
  const refresh = useCallback(() => {
    setBuckets(getBuckets())
    setMetrics(computeMetrics())
  }, [])

  useEffect(() => {
    refresh()
    let raf = 0
    const debounced = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(refresh)
    }
    window.addEventListener('vaultsentry:s3-buckets-updated', debounced)
    window.addEventListener('vaultsentry:s3-findings-updated', debounced)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('vaultsentry:s3-buckets-updated', debounced)
      window.removeEventListener('vaultsentry:s3-findings-updated', debounced)
      scanAbortRef.current?.abort()
    }
  }, [refresh])

  // Keep the findings drawer in sync without reading the full index on every render.
  useEffect(() => {
    if (!viewingFindingsFor) return
    setViewingFindings(getS3Findings(viewingFindingsFor.id))
  }, [viewingFindingsFor, metrics])

  const totals = useMemo(
    () => ({
      active: metrics.buckets,
      scanned: metrics.scanned,
      critical: metrics.bySeverity.critical,
      high: metrics.bySeverity.high,
      total: metrics.totalFindings,
    }),
    [metrics],
  )

  const resetForm = () => {
    setName('')
    setRegion('us-east-1')
    setAccessKeyId('')
    setSecretAccessKey('')
    setPathPrefix('')
  }

  const submitNew = () => {
    if (!name.trim()) {
      showToast('Bucket name is required', 'warning')
      return
    }
    if (!/^[a-z0-9.\-]{3,63}$/.test(name.trim())) {
      showToast('Bucket name must be 3-63 chars, lowercase', 'error')
      return
    }
    addBucket({
      name: name.trim(),
      region,
      accessKeyId: accessKeyId || undefined,
      secretAccessKey: secretAccessKey || undefined,
      pathPrefix: pathPrefix || undefined,
    })
    setBuckets(getBuckets())
    showToast(`Added s3://${name.trim()}`, 'success')
    setShowNew(false)
    resetForm()
  }

  const markScanning = (id: string, on: boolean) => {
    setScanningIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const runScan = useCallback(
    async (b: S3Bucket) => {
      if (scanningIds.has(b.id)) return
      markScanning(b.id, true)
      const ctrl = new AbortController()
      scanAbortRef.current = ctrl
      try {
        const res = await scanBucket(b.id, { signal: ctrl.signal })
        if (res.skipped && res.reason === 'cooldown') {
          showToast(`${b.name} was scanned recently — showing cached result`, 'info')
          return
        }
        const label = res.source === 'simulated' ? ' (simulated — backend offline)' : ''
        if (res.findings.length === 0) {
          showToast(`${b.name} is clean${label}`, 'success')
        } else {
          showToast(
            `${b.name}: ${res.findings.length} secret${
              res.findings.length === 1 ? '' : 's'
            } found${label}`,
            'warning',
          )
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          showToast(e?.message || 'Scan failed', 'error')
        }
      } finally {
        markScanning(b.id, false)
      }
    },
    [scanningIds, showToast],
  )

  const runScanAll = useCallback(async () => {
    if (scanningAll) return
    if (buckets.length === 0) {
      showToast('Add a bucket first', 'warning')
      return
    }
    setScanningAll(true)
    const ctrl = new AbortController()
    scanAbortRef.current = ctrl
    // Mark every bucket we're about to scan so each row shows its spinner.
    setScanningIds(new Set(buckets.map((b) => b.id)))
    try {
      const results = await scanAllBuckets({
        concurrency: 3,
        signal: ctrl.signal,
        onResult: (r) => markScanning(r.bucketId, false),
      })
      const fresh = results.filter((r) => !r.skipped)
      const cached = results.filter((r) => r.skipped).length
      const withFindings = fresh.reduce((n, r) => n + r.findings.length, 0)
      showToast(
        `Scanned ${fresh.length}/${results.length} bucket${results.length === 1 ? '' : 's'}` +
          (cached ? ` · ${cached} on cooldown` : '') +
          ` · ${withFindings} new finding${withFindings === 1 ? '' : 's'}`,
        withFindings > 0 ? 'warning' : 'success',
      )
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        showToast(e?.message || 'Scan-all failed', 'error')
      }
    } finally {
      setScanningAll(false)
      setScanningIds(new Set())
    }
  }, [buckets, scanningAll, showToast])

  const cancelAllScans = () => {
    scanAbortRef.current?.abort()
    setScanningAll(false)
    setScanningIds(new Set())
  }

  const remove = (b: S3Bucket) => {
    if (!confirm(`Remove s3://${b.name}? This also clears its findings.`)) return
    deleteBucket(b.id)
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1">
        <Header />
        <main className="mx-auto max-w-6xl px-6 py-8">
          <FeatureGate
            feature="aws_integration"
            title="S3 bucket scanning is a Premium Plus feature"
            description="Scan your AWS S3 buckets for exposed secrets, credentials, and PII — the same engine that protects your repos, pointed at your cloud storage."
            perks={[
              'Connect unlimited S3 buckets',
              'Scan objects on upload (event-driven)',
              'Entropy + pattern detection on file contents',
              'Per-bucket remediation playbooks',
            ]}
            requiredTier="premium_plus"
          >
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
                <Cloud className="h-6 w-6 text-[var(--accent)]" />
                S3 Bucket Scanning
              </h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Scan AWS S3 buckets for leaked credentials. Configure a bucket
                once, then run scans on demand or on a schedule.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {scanningAll ? (
                <button onClick={cancelAllScans} className="btn btn-secondary">
                  <X className="h-4 w-4" /> Cancel
                </button>
              ) : (
                <button
                  onClick={runScanAll}
                  disabled={buckets.length === 0}
                  className="btn btn-secondary"
                  title="Scan every bucket (3 in parallel)"
                >
                  <Sparkles className="h-4 w-4" /> Scan all
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4" /> Add bucket
              </button>
            </div>
          </div>

          {/* stat row */}
          <div className="mb-6 grid gap-3 md:grid-cols-4">
            <Stat
              icon={<Database className="h-4 w-4 text-[var(--accent)]" />}
              label="Buckets"
              value={String(totals.active)}
            />
            <Stat
              icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
              label="Scanned"
              value={String(totals.scanned)}
            />
            <Stat
              icon={<ShieldAlert className="h-4 w-4 text-red-400" />}
              label="Critical findings"
              value={String(totals.critical)}
            />
            <Stat
              icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
              label="High findings"
              value={String(totals.high)}
            />
          </div>

          {/* add-bucket drawer */}
          {showNew && (
            <div
              className="mb-6 rounded-2xl p-6"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--accent)',
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Connect an S3 bucket
                </h3>
                <button
                  onClick={() => {
                    setShowNew(false)
                    resetForm()
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    Bucket name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="prod-user-uploads"
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    Region
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm"
                  >
                    {AWS_REGIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    Access key ID <span className="opacity-50">(optional)</span>
                  </label>
                  <input
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    placeholder="AKIA…"
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    Secret access key <span className="opacity-50">(optional)</span>
                  </label>
                  <input
                    value={secretAccessKey}
                    onChange={(e) => setSecretAccessKey(e.target.value)}
                    type="password"
                    placeholder="••••••••••••••••"
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    Path prefix <span className="opacity-50">(optional)</span>
                  </label>
                  <input
                    value={pathPrefix}
                    onChange={(e) => setPathPrefix(e.target.value)}
                    placeholder="logs/"
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div
                className="mt-4 flex items-start gap-2 rounded-lg p-3 text-xs"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  We only store a fingerprint of the secret key (last 4
                  characters) locally. For production, use an IAM role with
                  read-only S3 access rather than long-lived keys.
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={submitNew} className="btn btn-primary">
                  Add bucket
                </button>
                <button
                  onClick={() => {
                    setShowNew(false)
                    resetForm()
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* buckets list */}
          {buckets.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{
                background: 'var(--card-bg)',
                border: '1px dashed var(--border-color)',
              }}
            >
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                <Cloud className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
                No S3 buckets connected
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
                Add your first S3 bucket to scan every object for leaked
                credentials, API keys and private keys.
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="btn btn-primary mx-auto mt-5"
              >
                <Plus className="h-4 w-4" /> Add your first bucket
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {buckets.map((b) => (
                <BucketRow
                  key={b.id}
                  bucket={b}
                  scanning={scanningIds.has(b.id)}
                  onScan={() => runScan(b)}
                  onRemove={() => remove(b)}
                  onView={() => setViewingFindingsFor(b)}
                />
              ))}
            </div>
          )}
          </FeatureGate>
        </main>
      </div>

      {/* findings drawer */}
      {viewingFindingsFor && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={() => setViewingFindingsFor(null)}
        >
          <div
            className="w-full max-w-2xl overflow-y-auto p-6"
            style={{ background: 'var(--bg-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Findings in{' '}
                  <span className="font-mono text-[var(--accent)]">
                    s3://{viewingFindingsFor.name}
                  </span>
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {viewingFindings.length} finding{viewingFindings.length === 1 ? '' : 's'} · Last
                  scan{' '}
                  {viewingFindingsFor.lastScanAt
                    ? new Date(viewingFindingsFor.lastScanAt).toLocaleString()
                    : '—'}
                </p>
              </div>
              <button
                onClick={() => setViewingFindingsFor(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {viewingFindings.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  No findings recorded for this bucket yet.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {viewingFindings.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-xl p-4"
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <SeverityChip severity={f.severity} />
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {f.secretType}
                          </span>
                        </div>
                        <div className="mt-1 truncate font-mono text-xs text-[var(--text-muted)]">
                          {f.key}
                        </div>
                        <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--bg-secondary)] p-2 text-xs text-[var(--text-muted)]">
                          {f.snippet}
                        </pre>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  )
}

function SeverityChip({ severity }: { severity: S3Finding['severity'] }) {
  const colors: Record<S3Finding['severity'], string> = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    medium: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    low: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  }
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[severity]}`}
    >
      {severity}
    </span>
  )
}

const BucketRow = memo(function BucketRow({
  bucket,
  scanning,
  onScan,
  onRemove,
  onView,
}: {
  bucket: S3Bucket
  scanning: boolean
  onScan: () => void
  onRemove: () => void
  onView: () => void
}) {
  const statusChip = () => {
    if (scanning || bucket.status === 'scanning') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Scanning
        </span>
      )
    }
    if (bucket.status === 'has_findings') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
          <ShieldAlert className="h-3 w-3" /> {bucket.lastFindings} finding
          {bucket.lastFindings === 1 ? '' : 's'}
        </span>
      )
    }
    if (bucket.status === 'clean') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
          <ShieldCheck className="h-3 w-3" /> Clean
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
        Not scanned
      </span>
    )
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-[var(--accent)]" />
            <span className="truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
              s3://{bucket.name}
            </span>
            {statusChip()}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
            <span>Region: {bucket.region}</span>
            {bucket.pathPrefix && <span>Prefix: {bucket.pathPrefix}</span>}
            {bucket.accessKeyId && (
              <span className="font-mono">
                Key: {bucket.accessKeyId.slice(0, 6)}…
              </span>
            )}
            {bucket.lastScanAt && (
              <span>
                Last scan: {new Date(bucket.lastScanAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {bucket.lastFindings ? (
            <button
              onClick={onView}
              className="btn btn-secondary"
              title="View findings"
            >
              <Search className="h-4 w-4" /> View
            </button>
          ) : null}
          <button
            onClick={onScan}
            disabled={scanning}
            className="btn btn-primary"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Scanning
              </>
            ) : (
              <>
                <Radar className="h-4 w-4" /> Scan now
              </>
            )}
          </button>
          <button
            onClick={onRemove}
            title="Remove bucket"
            className="rounded-md p-2 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
})
