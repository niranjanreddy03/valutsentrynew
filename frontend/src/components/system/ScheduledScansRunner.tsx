'use client'

/**
 * Mount this once at the app root. While the app is open, it checks for
 * due scheduled scans every minute and fires them. Safe to mount multiple
 * times — the scheduler guards against double-fire by advancing
 * `nextRunAt` before it triggers the scan.
 */

import { useEffect } from 'react'
import { tickSchedules } from '@/lib/scheduledScans'
import { useAuth } from '@/contexts/AuthContext'

const TICK_MS = 60 * 1000

export default function ScheduledScansRunner() {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      try {
        await tickSchedules()
      } catch (e) {
        console.warn('[scheduler] tick failed', e)
      }
    }
    // Kick once after mount then on an interval.
    void run()
    const id = setInterval(run, TICK_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [isAuthenticated])

  return null
}
