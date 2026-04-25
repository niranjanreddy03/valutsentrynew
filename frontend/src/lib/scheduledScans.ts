/**
 * Scheduled scans — client-side scheduler.
 *
 * Schedules are stored in localStorage and a lightweight tick function
 * fires any due schedule. The tick is driven by a `setInterval` set up in
 * the root provider, so scans run while the user has the app open. For
 * off-hours scheduling we'd need a backend cron, but this covers 95% of
 * the "I opened the tab and forgot about it" use case.
 */

import { getAuthHeaders } from '@/lib/authHeaders'

export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly'

export interface ScheduledScan {
  id: string
  repositoryId: number | string
  repositoryName: string
  repositoryUrl?: string
  branch: string
  frequency: ScheduleFrequency
  enabled: boolean
  lastRunAt?: string
  nextRunAt: string
  createdAt: string
}

const STORAGE_KEY = 'vaultsentry_scheduled_scans'

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getSchedules(): ScheduledScan[] {
  const s = safeStorage()
  if (!s) return []
  try {
    const raw = s.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ScheduledScan[]
  } catch {
    return []
  }
}

export function saveSchedules(list: ScheduledScan[]): void {
  const s = safeStorage()
  if (!s) return
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('vaultsentry:scheduled-scans-updated'))
  } catch {
    /* noop */
  }
}

export function frequencyMs(f: ScheduleFrequency): number {
  switch (f) {
    case 'hourly':
      return 60 * 60 * 1000
    case 'daily':
      return 24 * 60 * 60 * 1000
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000
  }
}

export function nextRunFrom(from: Date, f: ScheduleFrequency): string {
  return new Date(from.getTime() + frequencyMs(f)).toISOString()
}

export function upsertSchedule(patch: Partial<ScheduledScan> & { id?: string }): ScheduledScan {
  const list = getSchedules()
  const now = new Date()
  if (patch.id) {
    const idx = list.findIndex((s) => s.id === patch.id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch } as ScheduledScan
      saveSchedules(list)
      return list[idx]
    }
  }
  const freq = (patch.frequency ?? 'daily') as ScheduleFrequency
  const created: ScheduledScan = {
    id:
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)) + '',
    repositoryId: patch.repositoryId!,
    repositoryName: patch.repositoryName ?? '',
    repositoryUrl: patch.repositoryUrl,
    branch: patch.branch ?? 'main',
    frequency: freq,
    enabled: patch.enabled ?? true,
    nextRunAt: patch.nextRunAt ?? nextRunFrom(now, freq),
    createdAt: now.toISOString(),
  }
  list.push(created)
  saveSchedules(list)
  return created
}

export function deleteSchedule(id: string): void {
  saveSchedules(getSchedules().filter((s) => s.id !== id))
}

async function runScan(s: ScheduledScan): Promise<boolean> {
  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        scan_id: s.repositoryId,
        repository_id: s.repositoryId,
        repository_url: s.repositoryUrl,
        branch: s.branch || 'main',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Look at every enabled schedule and fire any that are due. Returns the
 * number of scans triggered. Safe to call on a tight interval — each
 * schedule advances `nextRunAt` before the scan call so we don't double-fire.
 */
export async function tickSchedules(): Promise<number> {
  const list = getSchedules()
  const now = new Date()
  const due = list.filter((s) => s.enabled && new Date(s.nextRunAt) <= now)
  if (due.length === 0) return 0
  // Mark them as "running" by advancing their nextRunAt first to avoid
  // re-entrancy if the tick fires twice before scans complete.
  for (const s of due) {
    s.lastRunAt = now.toISOString()
    s.nextRunAt = nextRunFrom(now, s.frequency)
  }
  saveSchedules(list)
  let fired = 0
  for (const s of due) {
    const ok = await runScan(s)
    if (ok) fired++
  }
  return fired
}
