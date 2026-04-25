'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/authHeaders'

interface RawReport {
  generated_at: string
  summary: {
    total_repositories: number
    total_scans: number
    completed_scans: number
    total_secrets: number
    active_secrets: number
    by_severity: { critical: number; high: number; medium: number; low: number }
  }
  repositories: Array<{ name: string; url: string; secrets_count: number; last_scan_at: string | null }>
  scans: Array<{
    id: number
    repository: string
    status: string
    files_scanned: number
    secrets_found: number
    duration_seconds: number
    completed_at: string | null
  }>
  findings: Array<{
    id: number
    repository: string
    type: string
    severity: string
    file: string
    line: number
    description: string
    status: string
    detected_at: string
  }>
}

type SevKey = 'critical' | 'high' | 'medium' | 'low'

const SEV_ORDER: SevKey[] = ['critical', 'high', 'medium', 'low']

const SEV_META: Record<SevKey, { color: string; soft: string; label: string; score: number }> = {
  critical: { color: '#b91c1c', soft: '#fef2f2', label: 'Critical', score: 10 },
  high: { color: '#c2410c', soft: '#fff7ed', label: 'High', score: 6 },
  medium: { color: '#a16207', soft: '#fefce8', label: 'Medium', score: 3 },
  low: { color: '#047857', soft: '#ecfdf5', label: 'Low', score: 1 },
}

export default function PDFReportPage() {
  const params = useSearchParams()
  const repoFilter = params.get('repo')

  const [raw, setRaw] = useState<RawReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports?type=full', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setRaw(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const report = useMemo(() => {
    if (!raw) return null
    if (!repoFilter) return raw

    const target = decodeURIComponent(repoFilter).toLowerCase()
    const repos = raw.repositories.filter((r) => r.name.toLowerCase() === target)
    const scans = raw.scans.filter((s) => s.repository.toLowerCase() === target)
    const findings = raw.findings.filter((f) => f.repository.toLowerCase() === target)

    const by_severity = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const f of findings) {
      const k = (f.severity || '').toLowerCase() as SevKey
      if (k in by_severity) by_severity[k]++
    }

    return {
      generated_at: raw.generated_at,
      summary: {
        total_repositories: repos.length,
        total_scans: scans.length,
        completed_scans: scans.filter((s) => s.status === 'completed').length,
        total_secrets: findings.length,
        active_secrets: findings.filter((f) => f.status === 'active').length,
        by_severity,
      },
      repositories: repos,
      scans,
      findings,
    } as RawReport
  }, [raw, repoFilter])

  useEffect(() => {
    if (report && !loading) {
      setTimeout(() => window.print(), 700)
    }
  }, [report, loading])

  const emptyStyle: React.CSSProperties = {
    padding: 60,
    fontFamily: 'Inter, Arial',
    textAlign: 'center',
    color: '#64748b',
  }

  if (loading) return <div style={emptyStyle}>Generating report…</div>
  if (!report) return <div style={emptyStyle}>Could not load report data.</div>
  if (report.summary.total_scans === 0) {
    return (
      <div style={emptyStyle}>
        <h2 style={{ color: '#0f172a', marginBottom: 8 }}>No scan data yet</h2>
        <p>Run a scan on {repoFilter ? decodeURIComponent(repoFilter) : 'a repository'} first.</p>
      </div>
    )
  }

  const sev = report.summary.by_severity
  const total = report.summary.total_secrets
  const weighted = sev.critical * 10 + sev.high * 6 + sev.medium * 3 + sev.low
  const riskScore = total === 0 ? 0 : Math.min(100, Math.round((weighted / Math.max(total, 1)) * 10))
  const riskLevel =
    total === 0 ? 'CLEAN' : riskScore >= 70 ? 'CRITICAL' : riskScore >= 40 ? 'ELEVATED' : riskScore >= 20 ? 'MODERATE' : 'LOW'
  const riskColor =
    total === 0
      ? '#047857'
      : riskScore >= 70
      ? '#b91c1c'
      : riskScore >= 40
      ? '#c2410c'
      : riskScore >= 20
      ? '#a16207'
      : '#047857'

  const target = repoFilter ? decodeURIComponent(repoFilter) : null
  const firstRepo = report.repositories[0]
  const generated = new Date(report.generated_at)

  // Top offending files (group findings by file, sorted by weighted severity)
  const fileBuckets = new Map<
    string,
    { file: string; count: number; weighted: number; sev: Record<SevKey, number>; repo: string }
  >()
  for (const f of report.findings) {
    const key = `${f.repository}::${f.file}`
    const bucket =
      fileBuckets.get(key) ?? {
        file: f.file,
        count: 0,
        weighted: 0,
        sev: { critical: 0, high: 0, medium: 0, low: 0 },
        repo: f.repository,
      }
    const sevKey = (f.severity || 'low').toLowerCase() as SevKey
    bucket.count++
    bucket.weighted += SEV_META[sevKey]?.score ?? 1
    if (sevKey in bucket.sev) bucket.sev[sevKey]++
    fileBuckets.set(key, bucket)
  }
  const topFiles = Array.from(fileBuckets.values())
    .sort((a, b) => b.weighted - a.weighted || b.count - a.count)
    .slice(0, 8)

  // Secret types distribution
  const typeBuckets = new Map<string, number>()
  for (const f of report.findings) typeBuckets.set(f.type, (typeBuckets.get(f.type) ?? 0) + 1)
  const topTypes = Array.from(typeBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const reportId = `VS-${generated.getFullYear()}-${String(generated.getMonth() + 1).padStart(2, '0')}${String(
    generated.getDate(),
  ).padStart(2, '0')}-${Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0')}`

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap');
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
          @page { margin: 0.5in 0.55in; size: A4; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: #f4f4f1; overflow-x: hidden; }
        body { font-family: 'Inter', -apple-system, sans-serif; color: #111827; line-height: 1.55; font-size: 13px; }
        .sheet { max-width: 860px; width: 100%; margin: 0 auto; background: #fff; overflow-wrap: break-word; word-wrap: break-word; }
        .sheet, .sheet * { min-width: 0; }

        /* ---------- Cover ---------- */
        .cover { position: relative; padding: 72px 64px 56px; color: #0b1220; border-bottom: 1px solid #111827; }
        .cover::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px; background: #111827; }
        .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 48px; }
        .brand-mark { width: 30px; height: 30px; border-radius: 7px; background: #111827; color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 13px; letter-spacing: -0.5px; }
        .brand-name { font-size: 14px; font-weight: 700; letter-spacing: 0.4px; }
        .brand-sep { flex: 1; height: 1px; background: #d1d5db; }
        .brand-stamp { font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: #6b7280; font-weight: 600; }

        .eyebrow { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #6b7280; margin-bottom: 18px; font-weight: 600; }
        .cover-title { font-family: 'Fraunces', Georgia, serif; font-size: 52px; font-weight: 600; line-height: 1.02; letter-spacing: -1.2px; margin-bottom: 18px; color: #0b1220; }
        .cover-title em { font-style: italic; font-weight: 400; color: #4b5563; }
        .cover-lede { font-size: 15px; color: #4b5563; max-width: 620px; line-height: 1.6; margin-bottom: 56px; }

        .cover-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; padding-top: 28px; border-top: 1px solid #e5e7eb; }
        .meta-label { font-size: 9.5px; letter-spacing: 2px; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; font-weight: 600; }
        .meta-value { font-size: 13px; font-weight: 600; color: #111827; font-variant-numeric: tabular-nums; }
        .meta-value-sm { font-size: 11.5px; color: #4b5563; font-family: 'JetBrains Mono', monospace; font-weight: 500; }

        /* ---------- Verdict strip ---------- */
        .verdict { display: grid; grid-template-columns: 1fr 320px; gap: 0; border-bottom: 1px solid #111827; }
        .verdict-text { padding: 42px 64px; background: #fff; }
        .verdict-kicker { font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: #6b7280; margin-bottom: 12px; font-weight: 600; }
        .verdict-title { font-family: 'Fraunces', Georgia, serif; font-size: 28px; font-weight: 600; line-height: 1.15; letter-spacing: -0.4px; color: #0b1220; margin-bottom: 12px; }
        .verdict-body { font-size: 13.5px; color: #374151; line-height: 1.65; max-width: 460px; }
        .verdict-score { padding: 42px 36px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; border-left: 1px solid #111827; }
        .score-level { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; font-weight: 700; margin-bottom: 10px; }
        .score-number { font-family: 'Fraunces', Georgia, serif; font-size: 82px; font-weight: 600; line-height: 1; letter-spacing: -3px; margin-bottom: 2px; }
        .score-caption { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #6b7280; font-weight: 600; }

        /* ---------- Sections ---------- */
        .section { padding: 40px 64px; border-bottom: 1px solid #e5e7eb; }
        .section:last-child { border-bottom: none; }
        .section-header { display: flex; align-items: baseline; gap: 14px; margin-bottom: 26px; }
        .section-num { font-family: 'Fraunces', Georgia, serif; font-size: 13px; color: #9ca3af; font-weight: 500; letter-spacing: 1px; }
        .section-title { font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 600; letter-spacing: -0.3px; color: #0b1220; }
        .section-rule { flex: 1; height: 1px; background: #e5e7eb; align-self: center; }

        /* Stat ribbon */
        .ribbon { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #111827; margin-bottom: 28px; }
        .ribbon-cell { padding: 22px 20px; border-right: 1px solid #e5e7eb; }
        .ribbon-cell:last-child { border-right: none; }
        .ribbon-value { font-family: 'Fraunces', Georgia, serif; font-size: 34px; font-weight: 600; line-height: 1; letter-spacing: -1px; color: #0b1220; }
        .ribbon-label { font-size: 9.5px; letter-spacing: 2px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-top: 8px; }

        /* Severity bars */
        .sev-stack { border: 1px solid #e5e7eb; }
        .sev-row { display: grid; grid-template-columns: 110px 1fr 70px 60px; gap: 16px; padding: 14px 20px; align-items: center; border-bottom: 1px solid #f1f5f4; }
        .sev-row:last-child { border-bottom: none; }
        .sev-name { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; }
        .sev-track { height: 14px; background: #f3f4f6; position: relative; overflow: hidden; border-radius: 2px; }
        .sev-fill { height: 100%; border-radius: 2px; }
        .sev-count { font-family: 'Fraunces', Georgia, serif; font-size: 20px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
        .sev-pct { font-size: 11px; color: #6b7280; text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }

        /* Two-column callouts */
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .panel { border: 1px solid #e5e7eb; padding: 22px 24px; }
        .panel-title { font-size: 10px; letter-spacing: 2.2px; text-transform: uppercase; color: #6b7280; font-weight: 700; margin-bottom: 14px; }
        .type-row { display: flex; justify-content: space-between; align-items: baseline; padding: 7px 0; border-bottom: 1px dashed #e5e7eb; font-size: 12.5px; }
        .type-row:last-child { border-bottom: none; }
        .type-name { color: #111827; font-weight: 500; }
        .type-count { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #4b5563; font-weight: 500; }

        /* Tables */
        .tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .tbl th { text-align: left; padding: 10px 12px; font-size: 9.5px; letter-spacing: 1.8px; text-transform: uppercase; color: #6b7280; font-weight: 700; border-bottom: 1.5px solid #111827; }
        .tbl th.num { text-align: right; }
        .tbl td { padding: 11px 12px; border-bottom: 1px solid #f1f5f4; vertical-align: middle; color: #111827; }
        .tbl td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .tbl tbody tr:last-child td { border-bottom: 1px solid #111827; }
        .tbl .mono { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; }
        .tbl .mute { color: #6b7280; font-size: 11.5px; }

        /* Severity chip */
        .chip { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }

        /* Findings list */
        .find { display: grid; grid-template-columns: 42px 1fr; border-bottom: 1px solid #e5e7eb; }
        .find:first-of-type { border-top: 1px solid #111827; }
        .find:last-of-type { border-bottom: 1px solid #111827; }
        .find-rail { border-right: 1px solid #e5e7eb; padding: 16px 0; text-align: center; font-family: 'Fraunces', Georgia, serif; font-size: 15px; color: #9ca3af; font-weight: 500; }
        .find-body { padding: 16px 20px; }
        .find-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }
        .find-type { font-size: 14px; font-weight: 700; color: #0b1220; letter-spacing: -0.2px; }
        .find-repo { font-size: 11px; color: #6b7280; font-weight: 500; }
        .find-loc { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #374151; margin-top: 4px; word-break: break-all; }
        .find-loc .line { color: #9ca3af; }

        /* Recommendations */
        .rec { display: grid; grid-template-columns: 32px 1fr; gap: 0; border-bottom: 1px solid #e5e7eb; padding: 18px 0; }
        .rec:first-of-type { border-top: 1px solid #111827; }
        .rec:last-of-type { border-bottom: 1px solid #111827; }
        .rec-num { font-family: 'Fraunces', Georgia, serif; font-size: 18px; color: #9ca3af; font-weight: 500; }
        .rec-title { font-size: 13.5px; font-weight: 700; color: #0b1220; margin-bottom: 4px; letter-spacing: -0.1px; }
        .rec-body { font-size: 12.5px; color: #4b5563; line-height: 1.65; }

        /* Footer */
        .footer { padding: 32px 64px 40px; display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: center; background: #0b1220; color: #cbd5e1; }
        .footer-left { font-size: 11px; line-height: 1.6; }
        .footer-brand { font-weight: 700; color: #fff; letter-spacing: 0.3px; margin-bottom: 2px; font-size: 12px; }
        .footer-confidential { font-size: 9.5px; letter-spacing: 2.5px; text-transform: uppercase; color: #94a3b8; border: 1px solid #334155; padding: 7px 14px; font-weight: 600; }

        /* Print button */
        .print-btn { position: fixed; bottom: 24px; right: 24px; padding: 12px 22px; background: #0b1220; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 100; box-shadow: 0 10px 30px rgba(0,0,0,0.25); font-family: 'Inter', sans-serif; letter-spacing: 0.3px; }

        /* Long strings shouldn't force horizontal scroll on screen */
        .meta-value-sm, .find-loc, .tbl .mono, .find-type, .rec-body code { overflow-wrap: anywhere; word-break: break-word; }

        /* ---------- Responsive (screen only — print layout unchanged) ---------- */
        @media screen and (max-width: 900px) {
          .cover { padding: 48px 32px 36px; }
          .cover-title { font-size: 36px; letter-spacing: -0.6px; }
          .cover-lede { font-size: 14px; margin-bottom: 36px; }
          .cover-meta { grid-template-columns: repeat(2, 1fr); gap: 18px; }

          .verdict { grid-template-columns: 1fr; }
          .verdict-text { padding: 32px; }
          .verdict-score { padding: 28px 32px; border-left: none; border-top: 1px solid #111827; }
          .score-number { font-size: 64px; }

          .section { padding: 32px; }
          .section-title { font-size: 19px; }

          .ribbon { grid-template-columns: repeat(2, 1fr); }
          .ribbon-cell { border-right: none; border-bottom: 1px solid #e5e7eb; }
          .ribbon-cell:nth-child(odd) { border-right: 1px solid #e5e7eb; }
          .ribbon-cell:nth-last-child(-n+2) { border-bottom: none; }

          .sev-row { grid-template-columns: 80px 1fr 50px 44px; gap: 10px; padding: 12px 14px; }

          .two-col { grid-template-columns: 1fr; gap: 18px; }

          .tbl { font-size: 11.5px; }
          .tbl th, .tbl td { padding: 8px 8px; }

          .footer { padding: 24px 32px 32px; grid-template-columns: 1fr; }
        }

        @media screen and (max-width: 560px) {
          .cover-title { font-size: 28px; }
          .cover-meta { grid-template-columns: 1fr; }
          .ribbon { grid-template-columns: 1fr; }
          .ribbon-cell { border-right: none !important; border-bottom: 1px solid #e5e7eb; }
          .ribbon-cell:last-child { border-bottom: none; }
          .sev-row { grid-template-columns: 70px 1fr 44px; }
          .sev-row .sev-pct { display: none; }
          .tbl thead { display: none; }
          .tbl, .tbl tbody, .tbl tr, .tbl td { display: block; width: 100%; }
          .tbl tr { border-bottom: 1px solid #e5e7eb; padding: 6px 0; }
          .tbl td { padding: 4px 8px; border-bottom: none; }
          .tbl td.num { text-align: left; }
          .find { grid-template-columns: 32px 1fr; }
          .find-body { padding: 12px 14px; }
          .print-btn { bottom: 16px; right: 16px; padding: 10px 16px; font-size: 12px; }
        }
      `}</style>

      <button className="print-btn no-print" onClick={() => window.print()}>
        Save as PDF
      </button>

      <div className="sheet">
        {/* ---------- Cover ---------- */}
        <div className="cover">
          <div className="brand">
            <div className="brand-mark">VS</div>
            <div className="brand-name">VaultSentry</div>
            <div className="brand-sep" />
            <div className="brand-stamp">
              {target ? 'Repository audit' : 'Organization audit'}
            </div>
          </div>

          <div className="eyebrow">Security Assessment · Vol. 01</div>
          <h1 className="cover-title">
            {target ? (
              <>
                {target}
                <br />
                <em>secrets audit.</em>
              </>
            ) : (
              <>
                Secrets exposure,
                <br />
                <em>at a glance.</em>
              </>
            )}
          </h1>
          <p className="cover-lede">
            {target
              ? `A focused read of what VaultSentry found inside ${target} — where the risk sits, which files carry it, and the steps to close it out.`
              : 'A consolidated view of what VaultSentry found across your connected repositories — prioritised by severity and grouped for faster triage.'}
          </p>

          <div className="cover-meta">
            <div>
              <div className="meta-label">Issued</div>
              <div className="meta-value">
                {generated.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                })}
              </div>
            </div>
            <div>
              <div className="meta-label">Time</div>
              <div className="meta-value">
                {generated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div>
              <div className="meta-label">{target ? 'Repository' : 'Scope'}</div>
              <div className="meta-value-sm">
                {target
                  ? firstRepo?.url
                    ? firstRepo.url.replace(/^https?:\/\//, '').slice(0, 30)
                    : target
                  : `${report.summary.total_repositories} repositories`}
              </div>
            </div>
            <div>
              <div className="meta-label">Report ID</div>
              <div className="meta-value-sm">{reportId}</div>
            </div>
          </div>
        </div>

        {/* ---------- Verdict ---------- */}
        <div className="verdict avoid-break">
          <div className="verdict-text">
            <div className="verdict-kicker">The verdict</div>
            <div className="verdict-title">
              {total === 0
                ? 'No exposed secrets were detected.'
                : sev.critical > 0
                ? `${sev.critical} critical ${sev.critical === 1 ? 'finding needs' : 'findings need'} rotation now.`
                : sev.high > 0
                ? `${sev.high} high-severity ${sev.high === 1 ? 'issue' : 'issues'} should be closed out within 24 hours.`
                : `${total} low-to-moderate ${total === 1 ? 'finding' : 'findings'} recorded for review.`}
            </div>
            <p className="verdict-body">
              {total === 0 ? (
                <>
                  The last scan completed successfully{target ? ` for ${target}` : ''} and no
                  remediation is currently required. Keep VaultSentry running in CI to preserve this
                  state as the codebase evolves.
                </>
              ) : (
                <>
                  VaultSentry reviewed{' '}
                  <strong>
                    {report.summary.completed_scans} scan
                    {report.summary.completed_scans === 1 ? '' : 's'}
                  </strong>{' '}
                  across{' '}
                  <strong>
                    {report.summary.total_repositories} {target ? 'repository' : 'repositories'}
                  </strong>
                  . Findings are prioritised below by severity and concentration across files.
                </>
              )}
            </p>
          </div>
          <div className="verdict-score" style={{ background: riskColor + '10' }}>
            <div className="score-level" style={{ color: riskColor }}>
              {riskLevel} RISK
            </div>
            <div className="score-number" style={{ color: riskColor }}>
              {riskScore}
              <span style={{ fontSize: 22, color: '#9ca3af', marginLeft: 4 }}>/100</span>
            </div>
            <div className="score-caption">Composite risk score</div>
          </div>
        </div>

        {/* ---------- Section 01 — At a glance ---------- */}
        <div className="section avoid-break">
          <div className="section-header">
            <div className="section-num">01</div>
            <div className="section-title">At a glance</div>
            <div className="section-rule" />
          </div>

          <div className="ribbon">
            <div className="ribbon-cell">
              <div className="ribbon-value">{report.summary.total_repositories}</div>
              <div className="ribbon-label">{target ? 'Repository' : 'Repositories'}</div>
            </div>
            <div className="ribbon-cell">
              <div className="ribbon-value">{report.summary.completed_scans}</div>
              <div className="ribbon-label">Scans complete</div>
            </div>
            <div className="ribbon-cell">
              <div className="ribbon-value" style={{ color: total > 0 ? '#b91c1c' : '#047857' }}>
                {total}
              </div>
              <div className="ribbon-label">Secrets found</div>
            </div>
            <div className="ribbon-cell">
              <div className="ribbon-value" style={{ color: riskColor }}>
                {sev.critical + sev.high}
              </div>
              <div className="ribbon-label">Critical + High</div>
            </div>
          </div>

          <div className="sev-stack">
            {SEV_ORDER.map((level) => {
              const count = sev[level]
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const max = Math.max(sev.critical, sev.high, sev.medium, sev.low, 1)
              const width = count === 0 ? 0 : Math.max((count / max) * 100, 3)
              const meta = SEV_META[level]
              return (
                <div className="sev-row" key={level}>
                  <div className="sev-name" style={{ color: meta.color }}>
                    {meta.label}
                  </div>
                  <div className="sev-track">
                    <div
                      className="sev-fill"
                      style={{ width: `${width}%`, background: meta.color }}
                    />
                  </div>
                  <div className="sev-count">{count}</div>
                  <div className="sev-pct">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---------- Section 02 — Concentration ---------- */}
        {total > 0 && (
          <div className="section avoid-break">
            <div className="section-header">
              <div className="section-num">02</div>
              <div className="section-title">Where the risk concentrates</div>
              <div className="section-rule" />
            </div>

            <div className="two-col">
              <div className="panel">
                <div className="panel-title">Top offending files</div>
                {topFiles.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: '#6b7280' }}>No files to highlight.</p>
                ) : (
                  <table className="tbl" style={{ marginTop: -6 }}>
                    <tbody>
                      {topFiles.map((f, i) => (
                        <tr key={i}>
                          <td className="mono" style={{ paddingLeft: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            {f.file}
                            {!target && <div className="mute">{f.repo}</div>}
                          </td>
                          <td className="num" style={{ paddingRight: 0 }}>
                            <strong>{f.count}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="panel">
                <div className="panel-title">Secret types detected</div>
                {topTypes.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: '#6b7280' }}>None recorded.</p>
                ) : (
                  topTypes.map(([name, count]) => (
                    <div className="type-row" key={name}>
                      <div className="type-name">{name}</div>
                      <div className="type-count">× {count}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------- Section 03 — Scan history ---------- */}
        <div className="section avoid-break">
          <div className="section-header">
            <div className="section-num">03</div>
            <div className="section-title">Scan history</div>
            <div className="section-rule" />
          </div>

          {report.scans.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6b7280' }}>No scans recorded yet.</p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>Scan</th>
                  {!target && <th>Repository</th>}
                  <th>Status</th>
                  <th className="num">Files</th>
                  <th className="num">Secrets</th>
                  <th className="num">Duration</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {report.scans.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">#{s.id}</td>
                    {!target && (
                      <td>
                        <strong>{s.repository}</strong>
                      </td>
                    )}
                    <td>
                      <span
                        className="chip"
                        style={{
                          background: s.status === 'completed' ? '#ecfdf5' : '#fef2f2',
                          color: s.status === 'completed' ? '#047857' : '#b91c1c',
                        }}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="num">{s.files_scanned}</td>
                    <td className="num">
                      <strong style={{ color: s.secrets_found > 0 ? '#b91c1c' : '#047857' }}>
                        {s.secrets_found}
                      </strong>
                    </td>
                    <td className="num">{s.duration_seconds}s</td>
                    <td className="mute">
                      {s.completed_at
                        ? new Date(s.completed_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ---------- Section 04 — Detailed findings ---------- */}
        {report.findings.length > 0 && (
          <>
            <div className="page-break" />
            <div className="section">
              <div className="section-header">
                <div className="section-num">04</div>
                <div className="section-title">
                  Detailed findings · {report.findings.length}
                </div>
                <div className="section-rule" />
              </div>

              <div>
                {report.findings.map((f, i) => {
                  const sevKey = (f.severity || 'low').toLowerCase() as SevKey
                  const meta = SEV_META[sevKey] ?? SEV_META.low
                  return (
                    <div className="find avoid-break" key={f.id}>
                      <div className="find-rail">{String(i + 1).padStart(2, '0')}</div>
                      <div className="find-body">
                        <div className="find-head">
                          <span
                            className="chip"
                            style={{ background: meta.soft, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                          <span className="find-type">{f.type}</span>
                          {!target && <span className="find-repo">· {f.repository}</span>}
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: 10,
                              letterSpacing: 1.5,
                              textTransform: 'uppercase',
                              color: f.status === 'active' ? '#c2410c' : '#6b7280',
                              fontWeight: 700,
                            }}
                          >
                            {f.status}
                          </span>
                        </div>
                        <div className="find-loc">
                          {f.file}
                          <span className="line"> : {f.line}</span>
                        </div>
                        {f.description && (
                          <div
                            style={{
                              fontSize: 12,
                              color: '#4b5563',
                              marginTop: 6,
                              lineHeight: 1.55,
                            }}
                          >
                            {f.description}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ---------- Section 05 — Recommendations ---------- */}
        <div className="section avoid-break">
          <div className="section-header">
            <div className="section-num">05</div>
            <div className="section-title">Recommended next steps</div>
            <div className="section-rule" />
          </div>

          <div>
            {sev.critical > 0 && (
              <div className="rec">
                <div className="rec-num">01</div>
                <div>
                  <div className="rec-title" style={{ color: '#b91c1c' }}>
                    Rotate critical credentials immediately
                  </div>
                  <div className="rec-body">
                    Revoke and reissue the {sev.critical} critical{' '}
                    {sev.critical === 1 ? 'secret' : 'secrets'}. These typically cover production
                    keys, private keys, and root tokens — treat them as compromised until proven
                    otherwise.
                  </div>
                </div>
              </div>
            )}
            {sev.high > 0 && (
              <div className="rec">
                <div className="rec-num">{sev.critical > 0 ? '02' : '01'}</div>
                <div>
                  <div className="rec-title" style={{ color: '#c2410c' }}>
                    Close out high-severity findings within 24 hours
                  </div>
                  <div className="rec-body">
                    Review and remediate the {sev.high} high-severity{' '}
                    {sev.high === 1 ? 'finding' : 'findings'} — usually hardcoded passwords, API
                    keys, and database credentials. Rotate, move into a secrets manager, and
                    re-scan.
                  </div>
                </div>
              </div>
            )}
            <div className="rec">
              <div className="rec-num">
                {String(1 + (sev.critical > 0 ? 1 : 0) + (sev.high > 0 ? 1 : 0)).padStart(2, '0')}
              </div>
              <div>
                <div className="rec-title">Centralise secrets in a vault</div>
                <div className="rec-body">
                  Move credentials into AWS Secrets Manager, HashiCorp Vault, or Doppler. Inject
                  them at runtime via environment variables rather than committing to source.
                </div>
              </div>
            </div>
            <div className="rec">
              <div className="rec-num">
                {String(2 + (sev.critical > 0 ? 1 : 0) + (sev.high > 0 ? 1 : 0)).padStart(2, '0')}
              </div>
              <div>
                <div className="rec-title">Block secrets at the commit boundary</div>
                <div className="rec-body">
                  Install a pre-commit hook (e.g. gitleaks, VaultSentry CLI) so patterns never reach
                  history. Pair with <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>.gitignore</code>
                  {' '}entries for <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>.env</code> and credential
                  files.
                </div>
              </div>
            </div>
            <div className="rec">
              <div className="rec-num">
                {String(3 + (sev.critical > 0 ? 1 : 0) + (sev.high > 0 ? 1 : 0)).padStart(2, '0')}
              </div>
              <div>
                <div className="rec-title">Run VaultSentry continuously in CI</div>
                <div className="rec-body">
                  Add VaultSentry to every pull request and nightly build so regressions are caught
                  before they ship. Track findings over time to measure your exposure trend.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- Footer ---------- */}
        <div className="footer">
          <div className="footer-left">
            <div className="footer-brand">VaultSentry Security Platform</div>
            Generated automatically on{' '}
            {generated.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
            })}{' '}
            · Report {reportId} · Verify and prioritise findings against your organisation&apos;s
            security policies before action.
          </div>
          <div className="footer-confidential">Confidential</div>
        </div>
      </div>
    </>
  )
}
