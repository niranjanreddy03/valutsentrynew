'use client'

import FeatureGate from '@/components/FeatureGate'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useToast } from '@/contexts/ToastContext'
import { repositoryService } from '@/services/supabase'
import {
  deleteSchedule,
  getSchedules,
  ScheduledScan,
  tickSchedules,
  upsertSchedule,
  nextRunFrom,
} from '@/lib/scheduledScans'
import {
  CalendarClock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Freq = 'hourly' | 'daily' | 'weekly'

export default function ScheduledScansPage() {
  const { showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [schedules, setSchedules] = useState<ScheduledScan[]>([])
  const [repos, setRepos] = useState<any[]>([])
  const [showNew, setShowNew] = useState(false)

  const [repoId, setRepoId] = useState<string>('')
  const [branch, setBranch] = useState('main')
  const [frequency, setFrequency] = useState<Freq>('daily')

  useEffect(() => {
    setSchedules(getSchedules())
    repositoryService.getAll().then(setRepos).catch(() => {})
    const handler = () => setSchedules(getSchedules())
    window.addEventListener('vaultsentry:scheduled-scans-updated', handler)
    return () =>
      window.removeEventListener('vaultsentry:scheduled-scans-updated', handler)
  }, [])

  const repoMap = useMemo(() => {
    const m = new Map<string | number, any>()
    repos.forEach((r) => m.set(r.id, r))
    return m
  }, [repos])

  const addSchedule = () => {
    if (!repoId) {
      showToast('Pick a repository first', 'warning')
      return
    }
    const repo = repoMap.get(repoId) || repoMap.get(Number(repoId))
    if (!repo) {
      showToast('Repository not found', 'error')
      return
    }
    upsertSchedule({
      repositoryId: repo.id,
      repositoryName: repo.name || repo.full_name || String(repo.id),
      repositoryUrl: repo.url || repo.repo_url,
      branch: branch || 'main',
      frequency,
      enabled: true,
    })
    setSchedules(getSchedules())
    showToast('Schedule added', 'success')
    setShowNew(false)
    setRepoId('')
    setBranch('main')
    setFrequency('daily')
  }

  const toggle = (s: ScheduledScan) => {
    upsertSchedule({ id: s.id, enabled: !s.enabled })
    setSchedules(getSchedules())
  }

  const remove = (s: ScheduledScan) => {
    if (!confirm(`Delete the ${s.frequency} schedule for ${s.repositoryName}?`)) return
    deleteSchedule(s.id)
    setSchedules(getSchedules())
  }

  const runNow = async (s: ScheduledScan) => {
    upsertSchedule({ id: s.id, nextRunAt: new Date(0).toISOString() })
    const fired = await tickSchedules()
    setSchedules(getSchedules())
    if (fired > 0) showToast(`Triggered scan for ${s.repositoryName}`, 'success')
    else showToast('Scan could not be triggered', 'error')
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1">
        <Header />
        <main className="mx-auto max-w-6xl px-6 py-8">
          <FeatureGate
            feature="scheduled_scans"
            title="Scheduled scans are a Premium feature"
            description="Automate recurring scans on your repositories so secrets are caught the moment they land, even when you're not at your desk."
            perks={[
              'Hourly, daily, or weekly automated scans',
              'Scan multiple branches automatically',
              'Instant alerts on new findings',
              'Runs while the app is open in any tab',
            ]}
            requiredTier="premium"
          >
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
                <CalendarClock className="h-6 w-6 text-[var(--accent)]" />
                Scheduled Scans
              </h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Configure recurring scans so you don&apos;t have to remember to
                click the button. Schedules fire while the app is open in at
                least one tab.
              </p>
            </div>
            <button onClick={() => setShowNew(true)} className="btn btn-primary">
              <Plus className="h-4 w-4" /> New schedule
            </button>
          </div>

          {showNew && (
            <div
              className="mb-6 rounded-2xl p-6"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--accent)',
              }}
            >
              <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                New scheduled scan
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Repository
                  </label>
                  <select
                    value={repoId}
                    onChange={(e) => setRepoId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Select repository…</option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || r.full_name || r.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Branch
                  </label>
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as Freq)}
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="hourly">Every hour</option>
                    <option value="daily">Every day</option>
                    <option value="weekly">Every week</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={addSchedule} className="btn btn-primary">
                  Create schedule
                </button>
                <button onClick={() => setShowNew(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                First run: {new Date(nextRunFrom(new Date(), frequency)).toLocaleString()}
              </p>
            </div>
          )}

          {schedules.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{
                background: 'var(--card-bg)',
                border: '1px dashed var(--border-color)',
              }}
            >
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                <CalendarClock className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
                No schedules yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
                Add a schedule and VaultSentry will run the scan automatically on
                that cadence. You can pause or delete it any time.
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="btn btn-primary mx-auto mt-5"
              >
                <Plus className="h-4 w-4" /> Create your first schedule
              </button>
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
              }}
            >
              <table className="w-full text-sm">
                <thead
                  className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <tr>
                    <th className="px-4 py-3">Repository</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Last run</th>
                    <th className="px-4 py-3">Next run</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.id} className="border-t border-[var(--border-color)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                        {s.repositoryName}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{s.branch}</td>
                      <td className="px-4 py-3 capitalize text-[var(--text-muted)]">
                        {s.frequency}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {new Date(s.nextRunAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {s.enabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                            Paused
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => runNow(s)}
                            title="Run now"
                            className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                          >
                            <Zap className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggle(s)}
                            title={s.enabled ? 'Pause' : 'Resume'}
                            className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                          >
                            {s.enabled ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => remove(s)}
                            title="Delete"
                            className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            className="mt-6 flex items-start gap-2 rounded-xl p-3 text-xs text-[var(--text-muted)]"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <RefreshCw className="mt-0.5 h-3.5 w-3.5" />
            <span>
              Schedules run while VaultSentry is open in at least one browser
              tab. For always-on scheduling across reboots,{' '}
              <Link href="/pricing" className="text-[var(--accent)] underline">
                upgrade to Premium Plus
              </Link>{' '}
              for server-side cron.
            </span>
          </div>
          </FeatureGate>
        </main>
      </div>
    </div>
  )
}
