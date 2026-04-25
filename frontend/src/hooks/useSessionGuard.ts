'use client'

/**
 * useSessionGuard — periodic heartbeat + automatic reaction to anomaly
 * verdicts. Mount once, inside the authenticated layout.
 *
 * Behaviour:
 *   • On mount: GET /api/csrf so secureFetch has a token to send.
 *   • Every 2 minutes (while tab is visible): POST /api/session/heartbeat
 *     with the CSRF token.
 *   • On `rotate`  → refresh the Supabase access token (new cookies).
 *   • On `revoke`  → sign the user out and redirect to /login with a reason.
 *
 * The heartbeat is cheap (one Postgres upsert) and gives us an early warning
 * when a cookie has been exfiltrated and replayed from a different device.
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { secureFetch } from '@/lib/secureFetch'
import { getSupabaseClient } from '@/lib/supabase'

const supabase = getSupabaseClient()

const HEARTBEAT_MS = 2 * 60 * 1000

interface Verdict {
  status: 'ok' | 'rotate' | 'revoke'
  reason?: string
}

export function useSessionGuard(enabled: boolean) {
  const router = useRouter()
  const lastBeatAt = useRef(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    // Seed the CSRF cookie pair.
    fetch('/api/csrf', { credentials: 'include' }).catch(() => {})

    const beat = async () => {
      if (cancelled) return
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastBeatAt.current < HEARTBEAT_MS - 5_000) return
      lastBeatAt.current = Date.now()

      try {
        const res = await secureFetch('/api/session/heartbeat', { method: 'POST' })
        const verdict = (await res.json()) as Verdict

        if (verdict.status === 'rotate') {
          await supabase.auth.refreshSession().catch(() => {})
        } else if (verdict.status === 'revoke') {
          await supabase.auth.signOut().catch(() => {})
          router.replace(`/login?reason=${encodeURIComponent(verdict.reason ?? 'session')}`)
        }
      } catch {
        /* network blip — we'll try again next tick */
      }
    }

    // Fire immediately, then on a schedule and on tab-visible events.
    void beat()
    const interval = setInterval(beat, HEARTBEAT_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void beat()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, router])
}
