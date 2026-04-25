import { getAuthHeaders } from '@/lib/authHeaders'

type TerminalStatus = 'completed' | 'failed' | 'cancelled'

export interface ScanResult {
  status: TerminalStatus | 'timeout'
  secretsFound: number
  scanId?: number
}

/**
 * Poll the scanner backend (via the Next.js `/api/scans` proxy) for the latest
 * scan on a given repository until it reaches a terminal state. We poll the
 * scanner's own store (not Supabase) because the scanner writes scan state
 * to a local JSON store, not the Supabase `scans` table — polling Supabase
 * would wait forever.
 *
 * Default: poll every 2s for up to 3 minutes.
 */
export async function waitForScanCompletion(
  repositoryId: number,
  opts: {
    intervalMs?: number
    timeoutMs?: number
    scanId?: number
    onTick?: (status: string) => void
  } = {},
): Promise<ScanResult> {
  const intervalMs = opts.intervalMs ?? 2000
  const timeoutMs = opts.timeoutMs ?? 90 * 1000
  const start = Date.now()
  const headers = getAuthHeaders()
  console.log('[POLL] Starting poll for repo', repositoryId, 'scanId:', opts.scanId)

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs))

    try {
      // If we know the exact scan_id, fetch it directly.
      if (opts.scanId != null) {
        const res = await fetch(`/api/scans/${opts.scanId}`, { cache: 'no-store', headers })
        console.log('[POLL] /api/scans/' + opts.scanId, '→', res.status)
        if (res.ok) {
          const scan = await res.json()
          console.log('[POLL] scan.status =', scan.status, 'secrets_found =', scan.secrets_found)
          opts.onTick?.(scan.status || 'running')
          if (
            scan.status === 'completed' ||
            scan.status === 'failed' ||
            scan.status === 'cancelled'
          ) {
            return {
              status: scan.status as TerminalStatus,
              secretsFound: scan.secrets_found ?? 0,
              scanId: scan.id,
            }
          }
          continue
        }
        // If /api/scans/:id route isn't available (e.g. 404 because Next hasn't
        // hot-reloaded the new route), fall through to the list-based path.
      }

      // Fallback: list all scans. If we have the scanner-assigned scan_id,
      // match on that (most reliable — the scanner's repository_id won't
      // match our Supabase repo id). Otherwise fall back to repo-id matching.
      const res = await fetch('/api/scans', { cache: 'no-store', headers })
      if (!res.ok) continue
      const scans = (await res.json()) as any[]
      console.log('[POLL fallback] got', scans.length, 'scans from /api/scans')

      let newest: any
      if (opts.scanId != null) {
        newest = scans.find((s) => s.id === opts.scanId)
      }
      if (!newest) {
        const forRepo = scans
          .filter((s) => s.repository_id === repositoryId)
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
        newest = forRepo[0]
      }
      if (!newest) continue

      opts.onTick?.(newest.status || 'running')

      if (
        newest.status === 'completed' ||
        newest.status === 'failed' ||
        newest.status === 'cancelled'
      ) {
        return {
          status: newest.status as TerminalStatus,
          secretsFound: newest.secrets_found ?? 0,
          scanId: newest.id,
        }
      }
    } catch {
      // Transient error — keep polling
    }
  }

  return { status: 'timeout', secretsFound: 0 }
}
