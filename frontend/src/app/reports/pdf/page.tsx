'use client'

import { useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/authHeaders'

interface ReportData {
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
  scans: Array<{ id: number; repository: string; status: string; files_scanned: number; secrets_found: number; duration_seconds: number; completed_at: string | null }>
  findings: Array<{ id: number; repository: string; type: string; severity: string; file: string; line: number; description: string; status: string; detected_at: string }>
}

export default function PDFReportPage() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports?type=full', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => { setReport(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (report && !loading) {
      setTimeout(() => window.print(), 1000)
    }
  }, [report, loading])

  if (loading) return <div style={{ padding: 60, fontFamily: 'Inter, Arial', textAlign: 'center', color: '#64748b' }}>Generating report...</div>
  if (!report || report.summary.total_secrets === 0) return <div style={{ padding: 60, fontFamily: 'Inter, Arial', textAlign: 'center', color: '#64748b' }}>No scan data available. Run a scan first.</div>

  const sev = report.summary.by_severity
  const total = report.summary.total_secrets
  const riskScore = Math.min(100, Math.round(((sev.critical * 10) + (sev.high * 6) + (sev.medium * 3) + sev.low) / Math.max(total, 1) * 10))
  const riskLevel = riskScore >= 70 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW'
  const riskColor = riskScore >= 70 ? '#dc2626' : riskScore >= 40 ? '#ea580c' : riskScore >= 20 ? '#d97706' : '#16a34a'

  const sevColors: Record<string, { bg: string; text: string; light: string }> = {
    critical: { bg: '#dc2626', text: '#fff', light: '#fef2f2' },
    high: { bg: '#ea580c', text: '#fff', light: '#fff7ed' },
    medium: { bg: '#d97706', text: '#fff', light: '#fffbeb' },
    low: { bg: '#16a34a', text: '#fff', light: '#f0fdf4' },
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          @page { margin: 0.6in; size: A4; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; background: #fff; color: #0f172a; line-height: 1.6; }
        .report { max-width: 850px; margin: 0 auto; padding: 0; }

        /* Cover Section */
        .cover { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color: #fff; padding: 60px 50px; border-radius: 0 0 16px 16px; margin-bottom: 40px; position: relative; overflow: hidden; }
        .cover::before { content: ''; position: absolute; top: -50%; right: -20%; width: 500px; height: 500px; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%); }
        .cover::after { content: ''; position: absolute; bottom: -30%; left: -10%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(14,165,233,0.1) 0%, transparent 70%); }
        .cover-logo { display: flex; align-items: center; gap: 14px; margin-bottom: 40px; position: relative; z-index: 1; }
        .cover-logo-icon { width: 48px; height: 48px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; backdrop-filter: blur(10px); }
        .cover-logo-text { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
        .cover h1 { font-size: 36px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; position: relative; z-index: 1; }
        .cover-sub { font-size: 16px; color: #94a3b8; margin-bottom: 35px; position: relative; z-index: 1; }
        .cover-meta { display: flex; gap: 30px; position: relative; z-index: 1; }
        .cover-meta-item { }
        .cover-meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 3px; }
        .cover-meta-value { font-size: 14px; font-weight: 500; color: #e2e8f0; }

        /* Section */
        .section { padding: 0 10px; margin-bottom: 35px; }
        .section-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 10px; }
        .section-title .icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; }

        /* Risk Score */
        .risk-overview { display: grid; grid-template-columns: 200px 1fr; gap: 30px; align-items: center; padding: 30px; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
        .risk-gauge { text-align: center; }  
        .risk-circle { width: 140px; height: 140px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto; position: relative; }
        .risk-circle::before { content: ''; position: absolute; inset: 0; border-radius: 50%; border: 8px solid #e2e8f0; }
        .risk-circle::after { content: ''; position: absolute; inset: 0; border-radius: 50%; border: 8px solid transparent; border-top-color: var(--risk-color); border-right-color: var(--risk-color); transform: rotate(-45deg); }
        .risk-number { font-size: 40px; font-weight: 800; line-height: 1; }
        .risk-label-sm { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-top: 4px; }
        .risk-details { }
        .risk-level-badge { display: inline-block; padding: 6px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; }
        .risk-desc { font-size: 14px; color: #475569; line-height: 1.7; }

        /* Stats Grid */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
        .stat-card { padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; }
        .stat-value { font-size: 32px; font-weight: 800; color: #0f172a; line-height: 1; }
        .stat-label { font-size: 12px; color: #64748b; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

        /* Severity Cards */
        .sev-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 30px; }
        .sev-card { padding: 20px; border-radius: 12px; text-align: center; position: relative; overflow: hidden; }
        .sev-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; }
        .sev-icon { font-size: 20px; margin-bottom: 8px; }
        .sev-count { font-size: 36px; font-weight: 800; line-height: 1; }
        .sev-name { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; font-weight: 600; }
        .sev-pct { font-size: 12px; opacity: 0.6; margin-top: 2px; }

        /* Progress Bars */
        .progress-section { margin-bottom: 25px; }
        .progress-item { margin-bottom: 14px; }
        .progress-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
        .progress-label { font-size: 13px; font-weight: 600; color: #334155; text-transform: capitalize; }
        .progress-value { font-size: 13px; font-weight: 600; color: #64748b; }
        .progress-track { height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 5px; transition: width 0.5s; }

        /* Tables */
        .data-table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 25px; }
        .data-table thead th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
        .data-table tbody td { padding: 12px 16px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .data-table tbody tr:last-child td { border-bottom: none; }
        .data-table tbody tr:hover { background: #f8fafc; }

        /* Badges */
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.3px; }
        .badge-critical { background: #fef2f2; color: #dc2626; }
        .badge-high { background: #fff7ed; color: #ea580c; }
        .badge-medium { background: #fffbeb; color: #d97706; }
        .badge-low { background: #f0fdf4; color: #16a34a; }
        .badge-success { background: #f0fdf4; color: #16a34a; }
        .badge-active { background: #fffbeb; color: #d97706; }
        .badge-failed { background: #fef2f2; color: #dc2626; }

        /* File paths */
        .file-path { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11.5px; color: #475569; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Footer */
        .report-footer { text-align: center; padding: 30px 10px; margin-top: 20px; border-top: 2px solid #e2e8f0; }
        .footer-brand { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px; }
        .footer-disclaimer { font-size: 11px; color: #94a3b8; max-width: 500px; margin: 0 auto; }
        .footer-confidential { display: inline-block; padding: 4px 12px; background: #fef2f2; color: #dc2626; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px; margin-top: 10px; }

        /* Print Button */
        .print-btn { position: fixed; bottom: 30px; right: 30px; padding: 14px 28px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; z-index: 100; box-shadow: 0 8px 25px rgba(99,102,241,0.35); display: flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; }
        .print-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 30px rgba(99,102,241,0.4); }
      `}</style>

      <button className="print-btn no-print" onClick={() => window.print()}>
        📄 Save as PDF
      </button>

      <div className="report">
        {/* ── Cover ── */}
        <div className="cover">
          <div className="cover-logo">
            <div className="cover-logo-icon">🛡️</div>
            <div className="cover-logo-text">VaultSentry</div>
          </div>
          <h1>Security Scan Report</h1>
          <p className="cover-sub">Comprehensive analysis of secrets and credentials exposure across your codebase</p>
          <div className="cover-meta">
            <div className="cover-meta-item">
              <div className="cover-meta-label">Generated</div>
              <div className="cover-meta-value">{new Date(report.generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            <div className="cover-meta-item">
              <div className="cover-meta-label">Time</div>
              <div className="cover-meta-value">{new Date(report.generated_at).toLocaleTimeString()}</div>
            </div>
            <div className="cover-meta-item">
              <div className="cover-meta-label">Repositories</div>
              <div className="cover-meta-value">{report.summary.total_repositories} scanned</div>
            </div>
            <div className="cover-meta-item">
              <div className="cover-meta-label">Report ID</div>
              <div className="cover-meta-value">VS-{Date.now().toString(36).toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* ── Executive Summary ── */}
        <div className="section">
          <div className="section-title">
            <span className="icon" style={{ background: '#eff6ff', color: '#2563eb' }}>📊</span>
            Executive Summary
          </div>

          <div className="risk-overview">
            <div className="risk-gauge">
              <div className="risk-circle" style={{ '--risk-color': riskColor } as React.CSSProperties}>
                <div className="risk-number" style={{ color: riskColor }}>{riskScore}</div>
                <div className="risk-label-sm">Risk Score</div>
              </div>
            </div>
            <div className="risk-details">
              <div className="risk-level-badge" style={{ background: riskColor + '15', color: riskColor }}>
                ⚠️ {riskLevel} RISK
              </div>
              <p className="risk-desc">
                VaultSentry scanned <strong>{report.summary.total_repositories} {report.summary.total_repositories === 1 ? 'repository' : 'repositories'}</strong> and 
                detected <strong>{total} {total === 1 ? 'secret' : 'secrets'}</strong> across <strong>{report.summary.completed_scans} {report.summary.completed_scans === 1 ? 'scan' : 'scans'}</strong>. 
                {sev.critical > 0 && <> Found <strong style={{ color: '#dc2626' }}>{sev.critical} critical</strong> {sev.critical === 1 ? 'issue' : 'issues'} requiring immediate attention.</>}
                {sev.high > 0 && <> <strong style={{ color: '#ea580c' }}>{sev.high} high</strong> severity {sev.high === 1 ? 'finding' : 'findings'} should be addressed promptly.</>}
              </p>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{report.summary.total_repositories}</div>
              <div className="stat-label">Repositories</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{report.summary.completed_scans}</div>
              <div className="stat-label">Scans Completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{total}</div>
              <div className="stat-label">Secrets Found</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: riskColor }}>{sev.critical + sev.high}</div>
              <div className="stat-label">Critical + High</div>
            </div>
          </div>
        </div>

        {/* ── Severity Breakdown ── */}
        <div className="section">
          <div className="section-title">
            <span className="icon" style={{ background: '#fef2f2', color: '#dc2626' }}>🔴</span>
            Severity Breakdown
          </div>

          <div className="sev-row">
            {(['critical', 'high', 'medium', 'low'] as const).map(level => {
              const count = sev[level]
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const c = sevColors[level]
              const icons: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }
              return (
                <div key={level} className="sev-card" style={{ background: c.light, border: `1px solid ${c.bg}20` }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: c.bg }} />
                  <div className="sev-icon">{icons[level]}</div>
                  <div className="sev-count" style={{ color: c.bg }}>{count}</div>
                  <div className="sev-name" style={{ color: c.bg }}>{level}</div>
                  <div className="sev-pct">{pct}%</div>
                </div>
              )
            })}
          </div>

          <div className="progress-section">
            {(['critical', 'high', 'medium', 'low'] as const).map(level => {
              const count = sev[level]
              const maxCount = Math.max(sev.critical, sev.high, sev.medium, sev.low, 1)
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const width = Math.max((count / maxCount) * 100, 3)
              return (
                <div key={level} className="progress-item">
                  <div className="progress-header">
                    <span className="progress-label">{level}</span>
                    <span className="progress-value">{count} ({pct}%)</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${width}%`, background: sevColors[level].bg }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Scan History ── */}
        <div className="section">
          <div className="section-title">
            <span className="icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>🔍</span>
            Scan History
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Scan</th><th>Repository</th><th>Status</th><th>Files</th><th>Secrets</th><th>Duration</th><th>Completed</th></tr>
            </thead>
            <tbody>
              {report.scans.map(s => (
                <tr key={s.id}>
                  <td><strong>#{s.id}</strong></td>
                  <td><strong>{s.repository}</strong></td>
                  <td><span className={`badge badge-${s.status === 'completed' ? 'success' : 'failed'}`}>● {s.status}</span></td>
                  <td>{s.files_scanned}</td>
                  <td><strong>{s.secrets_found}</strong></td>
                  <td>{s.duration_seconds}s</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{s.completed_at ? new Date(s.completed_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Page Break ── */}
        <div className="page-break" />

        {/* ── Detailed Findings ── */}
        <div className="section">
          <div className="section-title">
            <span className="icon" style={{ background: '#fef2f2', color: '#dc2626' }}>📋</span>
            Detailed Findings ({report.findings.length})
          </div>

          {report.findings.map((f, i) => (
            <div key={f.id} style={{ 
              padding: '16px 20px', 
              marginBottom: 12, 
              borderRadius: 10, 
              border: `1px solid ${sevColors[f.severity]?.bg || '#e2e8f0'}20`,
              background: sevColors[f.severity]?.light || '#f8fafc',
              borderLeft: `4px solid ${sevColors[f.severity]?.bg || '#64748b'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>#{i + 1}</span>
                  <span className={`badge badge-${f.severity}`}>{f.severity.toUpperCase()}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{f.type}</span>
                </div>
                <span className={`badge badge-${f.status}`}>{f.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div><span style={{ color: '#64748b' }}>Repository:</span> <strong>{f.repository}</strong></div>
                <div><span style={{ color: '#64748b' }}>Line:</span> <strong>{f.line}</strong></div>
                <div style={{ gridColumn: '1/3' }}><span style={{ color: '#64748b' }}>File:</span> <span className="file-path" style={{ display: 'inline' }}>{f.file}</span></div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Recommendations ── */}
        <div className="section">
          <div className="section-title">
            <span className="icon" style={{ background: '#eff6ff', color: '#2563eb' }}>💡</span>
            Recommendations
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {sev.critical > 0 && (
              <div style={{ padding: '16px 20px', background: '#fef2f2', borderRadius: 10, borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#dc2626', marginBottom: 4 }}>🔴 Immediate Action Required</div>
                <div style={{ fontSize: 13, color: '#7f1d1d' }}>Rotate or revoke all {sev.critical} critical secrets immediately. These include private keys and high-value credentials that could lead to full system compromise.</div>
              </div>
            )}
            {sev.high > 0 && (
              <div style={{ padding: '16px 20px', background: '#fff7ed', borderRadius: 10, borderLeft: '4px solid #ea580c' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#ea580c', marginBottom: 4 }}>🟠 Address Within 24 Hours</div>
                <div style={{ fontSize: 13, color: '#7c2d12' }}>Review and remediate {sev.high} high-severity findings. These typically include hardcoded passwords, API keys, and database credentials.</div>
              </div>
            )}
            <div style={{ padding: '16px 20px', background: '#eff6ff', borderRadius: 10, borderLeft: '4px solid #2563eb' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#2563eb', marginBottom: 4 }}>🔵 Best Practices</div>
              <div style={{ fontSize: 13, color: '#1e3a5f' }}>
                • Use environment variables or secret managers (AWS Secrets Manager, HashiCorp Vault) instead of hardcoding credentials<br/>
                • Add .env files to .gitignore to prevent accidental commits<br/>
                • Implement pre-commit hooks to catch secrets before they reach the repository<br/>
                • Enable automated scanning in CI/CD pipelines for continuous protection
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="report-footer">
          <div className="footer-brand">🛡️ VaultSentry Security Platform</div>
          <div className="footer-disclaimer">
            This report was generated automatically by VaultSentry security scanner. 
            All findings should be verified and prioritized according to your organization&apos;s security policies.
          </div>
          <div className="footer-confidential">⚠️ CONFIDENTIAL — HANDLE WITH CARE</div>
        </div>
      </div>
    </>
  )
}
