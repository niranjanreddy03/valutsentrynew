"use client"

import Link from "next/link"
import { allFeatures, primaryNav, adminNav, utilityNav } from "./data"
import { useMemo, useState, useCallback } from "react"
import { useAuth, AuthGuard } from "./auth"
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"

/* ================================================================
   ICON HELPER
   ================================================================ */

export function Icon({ children, filled = false }) {
  return (
    <span className="material-symbols-outlined" data-filled={filled ? "true" : "false"}>
      {children}
    </span>
  )
}

/* ================================================================
   APP SHELL — V2 Template Design (Light Mode)
   ================================================================ */

export function AppShell({ active = "dashboard", children }) {
  return (
    <AuthGuard>
      <AppShellInner active={active}>{children}</AppShellInner>
    </AuthGuard>
  )
}

function AppShellInner({ active = "dashboard", children }) {
  const { user, logout } = useAuth()
  return (
    <div className="console-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span>TheVaultSentry</span>
          <small>Security Console</small>
        </Link>
        <NavSection items={primaryNav} active={active} />
        <div className="nav-divider" />
        <NavSection items={adminNav} active={active} title="Admin" />
        <div className="nav-divider" />
        <NavSection items={utilityNav} active={active} />
        <div className="sidebar-upgrade">
          <p className="upgrade-label">Upgrade Security</p>
          <p className="upgrade-desc">Unlock advanced threat intelligence and automation.</p>
          <Link className="button primary full" href="/choose-plan">Upgrade Now</Link>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <label className="search-box">
            <Icon>search</Icon>
            <input placeholder="Search features or assets..." />
          </label>
          <nav className="top-actions">
            {user && (
              <>
                <span className="user-pill"><Icon>person</Icon> {user.name}</span>
                <button className="button secondary" onClick={logout}>Logout</button>
              </>
            )}
          </nav>
        </header>
        {children}
      </div>
    </div>
  )
}

function NavSection({ items, active, title }) {
  return (
    <nav className="nav-section" aria-label={title || "Main navigation"}>
      {title && <p className="nav-title">{title}</p>}
      {items.map((item) => (
        <Link className={active === item.slug ? "nav-item active" : "nav-item"} href={item.href} key={item.slug}>
          <Icon filled={active === item.slug}>{item.icon}</Icon>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

/* ================================================================
   SHARED COMPONENTS
   ================================================================ */

export function FeatureCard({ title, icon, children }) {
  return (
    <article className="feature-card">
      <div className="card-title-row">
        <h2>{title}</h2>
        <Icon>{icon}</Icon>
      </div>
      <div className="card-copy">{children}</div>
    </article>
  )
}

function StatusDot({ color = "var(--green)" }) {
  return <span style={{ width: 7, height: 7, borderRadius: 999, background: color, display: "inline-block" }} />
}

function MetricCard({ label, value, icon, trend, trendUp }) {
  return (
    <article className="kpi-card">
      <p className="kpi-label">{label}</p>
      <strong>{value}</strong>
      {trend && (
        <small className={trendUp ? "positive" : ""}>
          <Icon>{trendUp ? "trending_up" : "trending_down"}</Icon> {trend}
        </small>
      )}
    </article>
  )
}

function DataTable({ columns, rows, mono }) {
  return (
    <div className="table-scroll">
      <table className="v2-table">
        <thead>
          <tr>
            {columns.map((col) => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={j === 0 && mono ? "mono-cell" : ""}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}><Icon>close</Icon></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function Toast({ message, type = "info", onClose }) {
  if (!message) return null
  return (
    <div className={`toast-msg ${type}`} onClick={onClose}>
      <Icon>{type === "success" ? "check_circle" : type === "error" ? "error" : type === "warning" ? "warning" : "info"}</Icon>
      <span>{message}</span>
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((message, type = "info") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])
  const ToastEl = toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null
  return { show, ToastEl }
}

function FormField({ label, children }) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

function EmptyState({ icon, title, desc, actionLabel, actionHref }) {
  return (
    <div className="empty-state">
      <Icon>{icon}</Icon>
      <h3>{title}</h3>
      <p>{desc}</p>
      {actionLabel && <Link className="button primary" href={actionHref}>{actionLabel}</Link>}
    </div>
  )
}

/* ================================================================
   FEATURE PAGE (catch-all template)
   ================================================================ */

export function FeaturePage({ feature, active }) {
  const related = getRelated(feature.slug)
  return (
    <AppShell active={active || feature.slug}>
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Feature area</p>
            <h1>{feature.label}</h1>
            <p>{feature.summary}</p>
          </div>
          <div className="heading-actions">
            <Link className="button secondary" href="/help">Documentation</Link>
            <Link className="button primary" href="/dashboard">Go to Dashboard</Link>
          </div>
        </section>

        <section className="feature-grid">
          <FeatureCard title="What this page handles" icon={feature.icon}>
            <p>{feature.summary}</p>
            <p className="muted-copy">This V2 screen keeps the new visual language while representing the matching main-frontend feature.</p>
          </FeatureCard>
          <FeatureCard title="Expected workflow" icon="account_tree">
            <ol className="steps">
              <li>Connect or select a source.</li>
              <li>Run or review the relevant security action.</li>
              <li>Triage findings and export or resolve the result.</li>
            </ol>
          </FeatureCard>
          <FeatureCard title="Data state" icon="database">
            <p>No sample operational data is invented here. Live values should come from the existing Supabase and scanner API flows when wired.</p>
          </FeatureCard>
        </section>

        <section className="table-card">
          <div className="card-title-row">
            <h2>Related Features</h2>
            <span className="mono-pill">V2 routes</span>
          </div>
          <div className="route-list">
            {related.map((item) => (
              <Link href={item.href} key={item.slug}>
                <Icon>{item.icon}</Icon>
                <span>{item.label}</span>
                <small>{item.summary}</small>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   DASHBOARD
   ================================================================ */

const exposureTrend = [
  { date: "15 Oct", resolved: 28000, new: 18000 },
  { date: "16 Oct", resolved: 32000, new: 22000 },
  { date: "17 Oct", resolved: 26000, new: 15000 },
  { date: "18 Oct", resolved: 35000, new: 20000 },
  { date: "19 Oct", resolved: 42000, new: 28000 },
  { date: "20 Oct", resolved: 38000, new: 24000 },
  { date: "21 Oct", resolved: 30000, new: 18000 },
  { date: "22 Oct", resolved: 34000, new: 22000 },
  { date: "23 Oct", resolved: 28000, new: 16000 },
  { date: "24 Oct", resolved: 36000, new: 20000 },
  { date: "25 Oct", resolved: 44000, new: 30000 },
  { date: "26 Oct", resolved: 40000, new: 25000 },
]

const coverageGroups = [
  { title: "Coverage providers", items: [{ name: "AWS", abbr: "aws", color: "#ff9900" }, { name: "Okta", abbr: "O", color: "#00297a" }, { name: "Google", abbr: "G", color: "#4285f4" }, { name: "Slack", abbr: "#", color: "#e01e5a" }] },
  { title: "Identity providers", items: [{ name: "Okta", abbr: "O", color: "#00297a" }, { name: "AWS", abbr: "aws", color: "#ff9900" }, { name: "Slack", abbr: "#", color: "#e01e5a" }, { name: "Adobe", abbr: "A", color: "#ff0000" }] },
  { title: "Applications", items: [{ name: "Okta", abbr: "O", color: "#00297a" }, { name: "AWS", abbr: "aws", color: "#ff9900" }, { name: "Google", abbr: "G", color: "#4285f4" }] },
]

const threatStats = [
  ["groups", "Users", "275"],
  ["group_work", "Groups", "138"],
  ["key", "Roles", "510"],
  ["contract", "Policies", "565"],
  ["apps", "Applications", "103"],
  ["verified_user", "Roles", "255"],
]

const heatmapTactics = ["Collection", "Credential Access", "Defense Evasion", "Denial of Service", "Discovery", "Execution", "Initial Access", "Lateral Movement"]
const heatmapWeeks = ["15 Oct", "16 Oct", "17 Oct", "18 Oct", "19 Oct"]
const heatmapValues = [
  [0, 0, 1, 0, 0], [0, 0, 2, 1, 0], [0, 1, 0, 0, 0], [2, 3, 4, 3, 2],
  [3, 4, 5, 4, 3], [1, 2, 3, 2, 1], [2, 3, 2, 0, 0], [0, 2, 1, 0, 0],
]

const radarData = [
  { axis: "Discovery", value: 85 }, { axis: "Initial Access", value: 72 },
  { axis: "Execution", value: 90 }, { axis: "Privilege Escalation", value: 65 },
  { axis: "Defense Evasion", value: 78 }, { axis: "Persistence", value: 58 },
  { axis: "Lateral Movement", value: 70 }, { axis: "Exfiltration", value: 62 },
]

const privilegedUsers = [
  { name: "aws", platform: "AWS", score: 10, severity: "critical", roles: "Admin, DevOps" },
  { name: "alex.morgan", platform: "Okta", score: 8, severity: "high", roles: "Super Admin" },
  { name: "svc-deploy", platform: "GitHub", score: 7, severity: "high", roles: "CI/CD Pipeline" },
  { name: "jennifer.wu", platform: "GCP", score: 6, severity: "medium", roles: "Project Owner" },
  { name: "root-access", platform: "AWS", score: 9, severity: "critical", roles: "Root Account" },
  { name: "k8s-admin", platform: "Azure", score: 5, severity: "medium", roles: "Cluster Admin" },
]

const repositoryRisks = [
  { name: "acme-corp/payments-api", score: 94, secrets: 14, age: "35m", contributorRisk: "critical" },
  { name: "acme-corp/user-auth-service", score: 87, secrets: 9, age: "2h", contributorRisk: "high" },
  { name: "acme-corp/infra-terraform", score: 76, secrets: 6, age: "18h", contributorRisk: "high" },
  { name: "acme-corp/mobile-app-ios", score: 61, secrets: 3, age: "2d", contributorRisk: "medium" },
  { name: "acme-corp/marketing-site", score: 38, secrets: 1, age: "6d", contributorRisk: "low" },
]

const activityFeed = [
  { id: 1, type: "critical", message: "AWS Access Key exposed in", repo: "vault-core/api-gateway", file: "config/prod.env", time: "2 min ago" },
  { id: 2, type: "warning", message: "GitHub PAT detected in", repo: "payments/stripe-integration", file: ".github/workflows/deploy.yml", time: "14 min ago" },
  { id: 3, type: "resolved", message: "Slack webhook token revoked in", repo: "infra/terraform-modules", file: "modules/alerts/main.tf", time: "28 min ago" },
  { id: 4, type: "critical", message: "Database connection string found in", repo: "auth/oauth-service", file: "src/db/connection.ts", time: "45 min ago" },
  { id: 5, type: "info", message: "SSH private key pattern matched in", repo: "ml/model-pipeline", file: "scripts/deploy.sh", time: "1h ago" },
  { id: 6, type: "resolved", message: "GCP service account key rotated in", repo: "infra/terraform-modules", file: "credentials/", time: "1.5h ago" },
]

/* --- Risk trend data (14-day) --- */
const riskTrendData = [
  { date: "May 1", critical: 18, high: 32 }, { date: "May 2", critical: 16, high: 30 },
  { date: "May 3", critical: 22, high: 35 }, { date: "May 4", critical: 20, high: 28 },
  { date: "May 5", critical: 24, high: 38 }, { date: "May 6", critical: 19, high: 33 },
  { date: "May 7", critical: 15, high: 29 }, { date: "May 8", critical: 17, high: 31 },
  { date: "May 9", critical: 21, high: 36 }, { date: "May 10", critical: 14, high: 27 },
  { date: "May 11", critical: 12, high: 24 }, { date: "May 12", critical: 16, high: 28 },
  { date: "May 13", critical: 13, high: 22 }, { date: "May 14", critical: 11, high: 20 },
]

/* --- Risk distribution data --- */
const riskDistribution = [
  { name: "Critical", value: 24, color: "#ef4444" },
  { name: "High", value: 48, color: "#f97316" },
  { name: "Medium", value: 42, color: "#f59e0b" },
  { name: "Low", value: 28, color: "#22c55e" },
]

/* --- Top secret types --- */
const topSecretTypes = [
  { type: "AWS Access Key", count: 34 },
  { type: "GitHub PAT", count: 28 },
  { type: "Database Connection String", count: 19 },
  { type: "Private RSA Key", count: 15 },
  { type: "Slack Webhook URL", count: 11 },
]

/* --- Closed-loop lifecycle --- */
const lifecycleStages = [
  { label: "Detected", icon: "search", count: 142, pct: "100%", color: "var(--red)" },
  { label: "Revoked", icon: "cancel", count: 98, pct: "69%", color: "var(--orange)" },
  { label: "Rotated", icon: "autorenew", count: 76, pct: "54%", color: "var(--primary)" },
  { label: "Verified", icon: "check_circle", count: 61, pct: "43%", color: "var(--green)" },
]

/* --- Critical findings --- */
const criticalFindings = [
  { id: "SEC-4201", severity: "critical", type: "AWS Access Key", repo: "acme-corp/payments-api", file: "config/prod.env", line: 14, env: "PROD", mlScore: 96, status: "open" },
  { id: "SEC-4199", severity: "critical", type: "Database Conn String", repo: "acme-corp/user-auth-service", file: "src/db/connection.ts", line: 8, env: "PROD", mlScore: 92, status: "open" },
  { id: "SEC-4195", severity: "high", type: "GitHub PAT", repo: "acme-corp/infra-terraform", file: ".github/workflows/deploy.yml", line: 23, env: "STG", mlScore: 87, status: "in-progress" },
  { id: "SEC-4192", severity: "high", type: "Private RSA Key", repo: "acme-corp/kubernetes-manifests", file: "certs/tls.key", line: 1, env: "PROD", mlScore: 85, status: "open" },
  { id: "SEC-4188", severity: "high", type: "Slack Webhook", repo: "acme-corp/notification-service", file: "src/integrations/slack.js", line: 42, env: "DEV", mlScore: 78, status: "in-progress" },
  { id: "SEC-4185", severity: "medium", type: "GCP Service Key", repo: "acme-corp/data-pipeline-etl", file: "credentials/gcp-sa.json", line: 1, env: "STG", mlScore: 65, status: "open" },
  { id: "SEC-4180", severity: "medium", type: "Stripe Secret Key", repo: "acme-corp/payments-api", file: "src/billing/stripe.ts", line: 19, env: "DEV", mlScore: 58, status: "fixed" },
]

/* --- Recent scans --- */
const recentScans = [
  { repo: "acme-corp/payments-api", status: "completed", branch: "main", secrets: 14, duration: "4m 12s", started: "10:24 AM", trigger: "CI/CD" },
  { repo: "acme-corp/user-auth-service", status: "completed", branch: "develop", secrets: 9, duration: "2m 48s", started: "10:18 AM", trigger: "Manual" },
  { repo: "acme-corp/infra-terraform", status: "running", branch: "main", secrets: "—", duration: "—", started: "10:31 AM", trigger: "Webhook" },
  { repo: "acme-corp/kubernetes-manifests", status: "completed", branch: "main", secrets: 5, duration: "3m 01s", started: "09:45 AM", trigger: "Scheduled" },
  { repo: "acme-corp/mobile-app-ios", status: "failed", branch: "release/3.2", secrets: "—", duration: "0m 18s", started: "09:30 AM", trigger: "Manual" },
]

/* --- Dashboard alerts --- */
const dashboardAlerts = [
  { id: 1, type: "critical", title: "AWS root key exposed", message: "Root account key found in payments-api config", repo: "acme-corp/payments-api", time: "2m ago" },
  { id: 2, type: "warning", title: "SLA breach imminent", message: "3 findings approaching 7-day remediation SLA", repo: "acme-corp/user-auth-service", time: "18m ago" },
  { id: 3, type: "info", title: "Scan completed", message: "Full scan completed with 5 findings", repo: "acme-corp/kubernetes-manifests", time: "45m ago" },
  { id: 4, type: "success", title: "Secret rotated", message: "GitHub PAT automatically rotated via closed-loop", repo: "acme-corp/infra-terraform", time: "1h ago" },
]

/* --- Stale repos --- */
const staleRepos = [
  { name: "acme-corp/design-system", lastScan: "12 days ago" },
  { name: "acme-corp/docs-internal", lastScan: "9 days ago" },
]

export function DashboardOverview() {
  const { user } = useAuth()
  const [dateRange, setDateRange] = useState("1W")
  const chartData = useMemo(() => {
    if (dateRange === "1D") return exposureTrend.slice(-3)
    return exposureTrend
  }, [dateRange])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const totalFindings = riskDistribution.reduce((s, d) => s + d.value, 0)

  return (
    <AppShell active="dashboard">
      <main className="content dashboard-content">

        {/* ── Welcome Hero ── */}
        <section className="welcome-hero">
          <div className="welcome-text">
            <h1>{greeting}, <span className="gradient-name">{user?.name || "Security Team"}</span></h1>
            <p>You have <b className="text-error">{riskDistribution[0].value} critical</b> findings requiring immediate action across <b>48</b> monitored repositories.</p>
            <div className="heading-actions">
              <Link className="button primary" href="/scans"><Icon>play_arrow</Icon> Run Security Scan</Link>
              <Link className="button secondary" href="/repositories"><Icon>folder_shared</Icon> Repositories</Link>
              <Link className="button secondary" href="/secrets">View all findings</Link>
            </div>
          </div>
          <article className="posture-hero-card">
            <div className="posture-header">
              <Icon filled>verified_user</Icon>
              <span>Security Posture</span>
            </div>
            <div className="posture-score-big">
              <strong>85</strong><span>/100</span>
            </div>
            <div className="posture-label positive"><Icon>trending_up</Icon> Healthy — improving</div>
            <div className="posture-quick-stats">
              <div><b>48</b><span>Repos</span></div>
              <div><b>24</b><span>Critical</span></div>
              <div><b>142</b><span>Secrets</span></div>
            </div>
          </article>
        </section>

        {/* ── Stale Scan Warning ── */}
        {staleRepos.length > 0 && (
          <section className="stale-warning">
            <Icon>warning</Icon>
            <p><b>{staleRepos.length} repositories</b> haven&apos;t been scanned in over 7 days: {staleRepos.map((r, i) => <span key={r.name}>{i > 0 && ", "}<code>{r.name}</code> ({r.lastScan})</span>)}</p>
            <Link className="button secondary" href="/repositories">Review all</Link>
          </section>
        )}

        {/* ── Executive KPIs ── */}
        <section className="dashboard-kpis">
          <article className="kpi-card">
            <p className="kpi-label"><Icon>shield</Icon> Secrets Detected</p>
            <strong>142</strong>
            <small className="negative"><Icon>trending_up</Icon> +12% vs last week</small>
          </article>
          <article className="kpi-card kpi-critical">
            <p className="kpi-label"><Icon>error</Icon> Critical Issues</p>
            <strong>24</strong>
            <small className="negative"><Icon>trending_up</Icon> +3 since yesterday</small>
          </article>
          <article className="kpi-card">
            <p className="kpi-label"><Icon>schedule</Icon> MTTR</p>
            <strong>4.2h</strong>
            <small className="positive"><Icon>trending_down</Icon> -18% vs last month</small>
          </article>
          <article className="kpi-card">
            <p className="kpi-label"><Icon>folder_shared</Icon> Repos Monitored</p>
            <strong>48</strong>
            <small className="positive"><Icon>trending_up</Icon> +3 this week</small>
          </article>
        </section>

        {/* ── Risk Overview: Pie + Trend ── */}
        <section className="dashboard-grid">
          <article className="dashboard-card span-5">
            <div className="card-title-row">
              <h2>Risk Distribution</h2>
              <span className="mono-pill">{totalFindings} findings</span>
            </div>
            <div className="chart-wrap" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                    {riskDistribution.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} findings`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="pie-legend">
              {riskDistribution.map((d) => (
                <span key={d.name}><i style={{ background: d.color }} />{d.name}: <b>{d.value}</b></span>
              ))}
            </div>
          </article>

          <article className="dashboard-card chart-card span-7">
            <div className="card-title-row">
              <h2>Risk Trend <span>14 days</span></h2>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={riskTrendData} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#737686" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#737686" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DashboardTooltip raw />} />
                  <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={false} name="Critical" />
                  <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} dot={false} name="High" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        {/* ── Exposure chart + Coverage ── */}
        <section className="dashboard-grid">
          <article className="dashboard-card chart-card span-8">
            <div className="card-title-row">
              <div>
                <h2>Open and Resolved Exposures</h2>
                <p>Resolved <b>45</b> · New <b>38</b></p>
              </div>
              <div className="segmented-control">
                {["1D", "1W", "1M", "1Y"].map((range) => (
                  <button className={dateRange === range ? "active" : ""} key={range} onClick={() => setDateRange(range)}>{range}</button>
                ))}
              </div>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="resolved-gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="new-gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#737686" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#737686" }} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tickLine={false} />
                  <Tooltip content={<DashboardTooltip />} />
                  <Area type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} fill="url(#resolved-gradient)" name="Resolved" dot={false} />
                  <Area type="monotone" dataKey="new" stroke="#2563eb" strokeWidth={2} fill="url(#new-gradient)" name="New" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="dashboard-card span-4">
            <h2>Coverage</h2>
            <div className="coverage-stack">
              {coverageGroups.map((group) => (
                <div className="coverage-group" key={group.title}>
                  <p>{group.title}</p>
                  <div>
                    {group.items.map((item) => (
                      <span className="provider-badge" key={`${group.title}-${item.name}`} style={{ "--provider": item.color }}>{item.abbr}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* ── Repo Risk + Top Secret Types ── */}
        <section className="dashboard-grid">
          <article className="dashboard-card span-7">
            <div className="card-title-row">
              <div>
                <h2>Repository Risk Ranking</h2>
                <p>Top repositories by risk score</p>
              </div>
              <Link className="button secondary" href="/repositories">View all</Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Repository</th><th>Risk Score</th><th>Secrets</th><th>Age</th><th>Trend</th></tr></thead>
                <tbody>
                  {repositoryRisks.map((repo) => (
                    <tr key={repo.name}>
                      <td><Icon>account_tree</Icon><code>{repo.name}</code></td>
                      <td><span className="risk-meter"><i style={{ width: `${repo.score}%` }} /></span><b>{repo.score}</b></td>
                      <td>{repo.secrets}</td>
                      <td>{repo.age}</td>
                      <td><SeverityBadge value={repo.contributorRisk} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="dashboard-card span-5">
            <div className="card-title-row">
              <h2>Top Secret Types</h2>
              <p>Patterns dominating exposure</p>
            </div>
            <div className="secret-type-list">
              {topSecretTypes.map((st) => (
                <div className="secret-type-row" key={st.type}>
                  <span>{st.type}</span>
                  <div className="secret-type-bar"><i style={{ width: `${(st.count / topSecretTypes[0].count) * 100}%` }} /></div>
                  <b>{st.count}</b>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* ── Closed-Loop Lifecycle ── */}
        <section className="lifecycle-section">
          <div className="card-title-row">
            <div>
              <h2>Secret Lifecycle</h2>
              <p>Remediation pipeline progress</p>
            </div>
            <span className="mono-pill">{Math.round((lifecycleStages[3].count / lifecycleStages[0].count) * 100)}% completion</span>
          </div>
          <div className="lifecycle-pipeline">
            {lifecycleStages.map((stage, i) => (
              <div className="lifecycle-stage" key={stage.label}>
                <div className="stage-icon" style={{ background: stage.color }}><Icon>{stage.icon}</Icon></div>
                <b>{stage.count}</b>
                <span>{stage.label}</span>
                <small>{stage.pct}</small>
                {i < lifecycleStages.length - 1 && <div className="stage-arrow"><Icon>arrow_forward</Icon></div>}
              </div>
            ))}
          </div>
          <div className="lifecycle-metrics">
            <div><b>4.2h</b><span>MTTR</span></div>
            <div><b>94%</b><span>SLA Compliance</span></div>
            <div><b>3</b><span>SLA Breaches</span></div>
            <div><b>42</b><span>Auto-Rotated</span></div>
          </div>
        </section>

        {/* ── Threats: Heatmap + Radar ── */}
        <section className="dashboard-grid">
          <article className="dashboard-card span-3">
            <h2>Threats Coverage</h2>
            <div className="threat-stat-list">
              {threatStats.map(([icon, label, value]) => (
                <div key={`${label}-${value}`}>
                  <span><Icon>{icon}</Icon>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-card span-5">
            <h2>Threats Tactics <span>Last 12 weeks</span></h2>
            <div className="heatmap-wrap">
              <table>
                <thead>
                  <tr>
                    <th />
                    {heatmapWeeks.map((week) => <th key={week}>{week}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {heatmapTactics.map((tactic, row) => (
                    <tr key={tactic}>
                      <td>{tactic}</td>
                      {heatmapValues[row].map((value, col) => (
                        <td key={`${tactic}-${col}`}>
                          <span style={{ opacity: value ? 0.2 + value * 0.16 : 0.08 }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="dashboard-card span-4">
            <h2>Threats Coverage Radar</h2>
            <div className="radar-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="58%">
                  <PolarGrid stroke="#c3c6d7" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: "#737686" }} />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.14} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        {/* ── Critical Findings Table ── */}
        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <div>
              <h2>Critical Findings</h2>
              <p>High-priority secrets requiring immediate action</p>
            </div>
            <Link className="button secondary" href="/secrets">View all findings</Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Repository</th>
                  <th>File</th>
                  <th>Line</th>
                  <th>Env</th>
                  <th>ML Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {criticalFindings.map((f) => (
                  <tr key={f.id}>
                    <td><SeverityBadge value={f.severity} /></td>
                    <td>{f.type}</td>
                    <td><code>{f.repo}</code></td>
                    <td><code className="text-primary">{f.file}</code></td>
                    <td>{f.line}</td>
                    <td><span className={`mono-pill ${f.env === "PROD" ? "env-prod" : ""}`}>{f.env}</span></td>
                    <td><span className="risk-meter"><i style={{ width: `${f.mlScore}%` }} /></span><b>{f.mlScore}</b></td>
                    <td><SeverityBadge value={f.status === "open" ? "high" : f.status === "in-progress" ? "medium" : "low"} label={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Privileged Users ── */}
        <section className="split-grid">
          <PrivilegedUsersPanel users={privilegedUsers.slice(0, 3)} title="Privileged Users at Risk" />
          <PrivilegedUsersPanel users={privilegedUsers.slice(3)} title="Privileged Users at Risk" />
        </section>

        {/* ── Recent Scans + Alerts ── */}
        <section className="dashboard-grid">
          <article className="dashboard-card span-7">
            <div className="card-title-row">
              <h2>Recent Scans</h2>
              <Link className="button secondary" href="/scans">View all scans</Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Repository</th><th>Status</th><th>Branch</th><th>Secrets</th><th>Duration</th><th>Trigger</th></tr></thead>
                <tbody>
                  {recentScans.map((s) => (
                    <tr key={s.repo + s.started}>
                      <td><code>{s.repo}</code></td>
                      <td><SeverityBadge value={s.status === "completed" ? "low" : s.status === "running" ? "medium" : "critical"} label={s.status} /></td>
                      <td><code>{s.branch}</code></td>
                      <td><b>{s.secrets}</b></td>
                      <td>{s.duration}</td>
                      <td><span className="mono-pill">{s.trigger}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="dashboard-card span-5">
            <div className="card-title-row">
              <h2><Icon>notifications</Icon> Alerts</h2>
              <span className="mono-pill">{dashboardAlerts.length} new</span>
            </div>
            <div className="alert-feed">
              {dashboardAlerts.map((a) => (
                <div className={`alert-item ${a.type}`} key={a.id}>
                  <Icon>{a.type === "critical" ? "error" : a.type === "warning" ? "warning" : a.type === "success" ? "check_circle" : "info"}</Icon>
                  <div>
                    <b>{a.title}</b>
                    <p>{a.message}</p>
                    <small><code>{a.repo}</code> · {a.time}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* ── Live Activity ── */}
        <section className="table-card live-activity">
          <div className="card-title-row">
            <h2><Icon>monitor_heart</Icon> Live Activity</h2>
            <span className="mono-pill streaming">Streaming</span>
          </div>
          <div className="activity-list">
            {activityFeed.map((item) => (
              <div className={`activity-item ${item.type}`} key={item.id}>
                <Icon>{activityIcon(item.type)}</Icon>
                <div>
                  <p>
                    <span>{activityLabel(item.type)}</span>
                    {item.message} <code>{item.repo}</code>
                  </p>
                  <small>{item.file}</small>
                </div>
                <time>{item.time}</time>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  )
}

function DashboardTooltip({ active, payload, label, raw }) {
  if (!active || !payload?.length) return null
  return (
    <div className="dashboard-tooltip">
      <p>{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey}>
          <span style={{ background: item.color }} />
          {item.name}: <b>{raw ? item.value : `${(item.value / 1000).toFixed(0)}k`}</b>
        </div>
      ))}
    </div>
  )
}

function SeverityBadge({ value, label }) {
  return <span className={`severity-badge ${value}`}>{label || value}</span>
}

function PrivilegedUsersPanel({ users, title }) {
  return (
    <article className="dashboard-card">
      <div className="card-title-row">
        <h2>{title}</h2>
        <div className="severity-legend">
          <span className="low">Low</span>
          <span className="medium">Medium</span>
          <span className="high">High</span>
          <span className="critical">Critical</span>
        </div>
      </div>
      <div className="user-risk-list">
        {users.map((user) => (
          <div className="user-risk-row" key={`${user.platform}-${user.name}`}>
            <div className="platform-badge">{user.platform}</div>
            <div>
              <code>{user.name}</code>
              <small>{user.roles}</small>
            </div>
            <span className={`score-bar ${user.severity}`}><i style={{ width: `${user.score * 10}%` }} /></span>
            <b className={user.severity}>{user.score}</b>
          </div>
        ))}
      </div>
    </article>
  )
}

/* ================================================================
   REPOSITORIES PAGE
   ================================================================ */

const repoInitial = [
  { id: 1, name: "acme-corp/payments-api", provider: "GitHub", url: "https://github.com/acme-corp/payments-api", branch: "main", lastScan: "35m ago", secrets: 14, status: "critical" },
  { id: 2, name: "acme-corp/user-auth-service", provider: "GitHub", url: "https://github.com/acme-corp/user-auth-service", branch: "develop", lastScan: "2h ago", secrets: 9, status: "critical" },
  { id: 3, name: "acme-corp/infra-terraform", provider: "GitLab", url: "https://gitlab.com/acme-corp/infra-terraform", branch: "main", lastScan: "18h ago", secrets: 6, status: "high" },
  { id: 4, name: "acme-corp/kubernetes-manifests", provider: "GitHub", url: "https://github.com/acme-corp/kubernetes-manifests", branch: "main", lastScan: "4h ago", secrets: 5, status: "high" },
  { id: 5, name: "acme-corp/mobile-app-ios", provider: "Bitbucket", url: "https://bitbucket.org/acme-corp/mobile-app-ios", branch: "release/3.2", lastScan: "1d ago", secrets: 3, status: "medium" },
  { id: 6, name: "acme-corp/notification-service", provider: "GitHub", url: "https://github.com/acme-corp/notification-service", branch: "main", lastScan: "6h ago", secrets: 2, status: "medium" },
  { id: 7, name: "acme-corp/data-pipeline-etl", provider: "GitLab", url: "https://gitlab.com/acme-corp/data-pipeline-etl", branch: "feature/spark-v3", lastScan: "12h ago", secrets: 2, status: "medium" },
  { id: 8, name: "acme-corp/marketing-site", provider: "GitHub", url: "https://github.com/acme-corp/marketing-site", branch: "main", lastScan: "3d ago", secrets: 1, status: "low" },
  { id: 9, name: "acme-corp/design-system", provider: "GitHub", url: "https://github.com/acme-corp/design-system", branch: "main", lastScan: "5d ago", secrets: 0, status: "low" },
  { id: 10, name: "acme-corp/docs-internal", provider: "GitLab", url: "https://gitlab.com/acme-corp/docs-internal", branch: "main", lastScan: "7d ago", secrets: 0, status: "low" },
]

export function RepositoriesPage() {
  const [repos, setRepos] = useState(repoInitial)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState("all")
  const [scanning, setScanning] = useState(new Set())
  const [repoUrl, setRepoUrl] = useState("")
  const [repoProvider, setRepoProvider] = useState("GitHub")
  const [repoBranch, setRepoBranch] = useState("main")
  const { show, ToastEl } = useToast()

  const filtered = useMemo(() => {
    if (filter === "all") return repos
    return repos.filter(r => r.status === filter)
  }, [repos, filter])

  const metrics = useMemo(() => ({
    total: repos.length,
    active: repos.filter(r => r.secrets > 0).length,
    secrets: repos.reduce((s, r) => s + r.secrets, 0),
    coverage: repos.length > 0 ? Math.round((repos.filter(r => r.lastScan !== "Never").length / repos.length) * 100) : 0,
  }), [repos])

  function addRepo() {
    if (!repoUrl.trim()) { show("Repository URL is required", "warning"); return }
    const name = repoUrl.replace(/https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\//, "").replace(/\.git$/, "")
    const newRepo = { id: Date.now(), name, provider: repoProvider, url: repoUrl.trim(), branch: repoBranch, lastScan: "Never", secrets: 0, status: "low" }
    setRepos(prev => [...prev, newRepo])
    show(`Connected ${name}`, "success")
    setShowAdd(false); setRepoUrl(""); setRepoProvider("GitHub"); setRepoBranch("main")
  }

  function scanRepo(id) {
    setScanning(prev => new Set(prev).add(id))
    setTimeout(() => {
      setRepos(prev => prev.map(r => r.id === id ? { ...r, lastScan: "Just now", secrets: Math.floor(Math.random() * 10), status: Math.random() > 0.5 ? "high" : "low" } : r))
      setScanning(prev => { const n = new Set(prev); n.delete(id); return n })
      show("Scan completed", "success")
    }, 2000)
  }

  function removeRepo(id) {
    setRepos(prev => prev.filter(r => r.id !== id))
    show("Repository disconnected", "info")
  }

  return (
    <AppShell active="repositories">
      <main className="content">
        {ToastEl}
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Source management</p>
            <h1>Repositories</h1>
            <p>Connect, scan, and monitor source repositories for exposed secrets across all branches.</p>
          </div>
          <div className="heading-actions">
            <select className="v2-select" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button className="button primary" onClick={() => setShowAdd(true)}><Icon>add</Icon> Connect Repository</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Total Repos" value={String(metrics.total)} trend="+3 this week" trendUp />
          <MetricCard label="With Secrets" value={String(metrics.active)} trend="Require attention" />
          <MetricCard label="Secrets Found" value={String(metrics.secrets)} trend="-8 from last week" trendUp />
          <MetricCard label="Coverage" value={`${metrics.coverage}%`} trend="+2% this month" trendUp />
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Connected Repositories</h2>
            <span className="mono-pill">{filtered.length} repos</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Repository</th><th>Provider</th><th>Branch</th><th>Last Scan</th><th>Secrets</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((repo) => (
                  <tr key={repo.id}>
                    <td><Icon>account_tree</Icon><code>{repo.name}</code></td>
                    <td>{repo.provider}</td>
                    <td><code>{repo.branch}</code></td>
                    <td>{repo.lastScan}</td>
                    <td><b className={repo.secrets > 0 ? "text-error" : ""}>{repo.secrets}</b></td>
                    <td><SeverityBadge value={repo.status} /></td>
                    <td className="action-cell">
                      <button className="icon-btn" title="Scan" onClick={() => scanRepo(repo.id)} disabled={scanning.has(repo.id)}>
                        <Icon>{scanning.has(repo.id) ? "hourglass_top" : "play_arrow"}</Icon>
                      </button>
                      <button className="icon-btn danger" title="Remove" onClick={() => removeRepo(repo.id)}>
                        <Icon>delete</Icon>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Connect Repository">
          <FormField label="Provider">
            <select className="v2-select full" value={repoProvider} onChange={e => setRepoProvider(e.target.value)}>
              <option>GitHub</option><option>GitLab</option><option>Bitbucket</option><option>Azure DevOps</option>
            </select>
          </FormField>
          <FormField label="Repository URL">
            <input className="v2-input" placeholder={`https://${repoProvider.toLowerCase().replace(" ", "")}.com/owner/repo`} value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
          </FormField>
          <FormField label="Branch">
            <input className="v2-input" placeholder="main" value={repoBranch} onChange={e => setRepoBranch(e.target.value)} />
          </FormField>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="button primary" onClick={addRepo}><Icon>add</Icon> Connect</button>
          </div>
        </Modal>
      </main>
    </AppShell>
  )
}

/* ================================================================
   SCANS PAGE
   ================================================================ */

const scanData = [
  { id: "SCN-1204", target: "vault-core/api-gateway", type: "Full Scan", started: "10:24 AM", duration: "4m 12s", findings: 12, status: "completed" },
  { id: "SCN-1203", target: "payments/stripe-integration", type: "Incremental", started: "10:18 AM", duration: "1m 48s", findings: 3, status: "completed" },
  { id: "SCN-1202", target: "infra/terraform-modules", type: "Full Scan", started: "10:15 AM", duration: "—", findings: "—", status: "running" },
  { id: "SCN-1201", target: "auth/oauth-service", type: "Scheduled", started: "09:00 AM", duration: "2m 33s", findings: 0, status: "completed" },
  { id: "SCN-1200", target: "devops/ci-configs", type: "Full Scan", started: "08:45 AM", duration: "3m 01s", findings: 6, status: "completed" },
  { id: "SCN-1199", target: "ml/model-pipeline", type: "Incremental", started: "08:30 AM", duration: "0m 54s", findings: 1, status: "completed" },
]

export function ScansPage() {
  const [scans, setScans] = useState(scanData)
  const [showNew, setShowNew] = useState(false)
  const [scanTarget, setScanTarget] = useState("")
  const [scanType, setScanType] = useState("Full Scan")
  const { show, ToastEl } = useToast()

  const metrics = useMemo(() => ({
    total: scans.length,
    completed: scans.filter(s => s.status === "completed").length,
    running: scans.filter(s => s.status === "running").length,
    findings: scans.reduce((s, sc) => s + (typeof sc.findings === "number" ? sc.findings : 0), 0),
  }), [scans])

  function startScan() {
    if (!scanTarget) { show("Select a target repository", "warning"); return }
    const newScan = { id: `SCN-${1205 + scans.length}`, target: scanTarget, type: scanType, started: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), duration: "—", findings: "—", status: "running" }
    setScans(prev => [newScan, ...prev])
    setShowNew(false); setScanTarget(""); setScanType("Full Scan")
    show(`Scan started on ${scanTarget}`, "info")
    setTimeout(() => {
      setScans(prev => prev.map(s => s.id === newScan.id ? { ...s, status: "completed", duration: `${Math.floor(Math.random() * 5) + 1}m ${Math.floor(Math.random() * 50)}s`, findings: Math.floor(Math.random() * 15) } : s))
      show("Scan completed", "success")
    }, 3000)
  }

  return (
    <AppShell active="scans">
      <main className="content">
        {ToastEl}
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Scan engine</p>
            <h1>Scans</h1>
            <p>Start, monitor, and review scan runs across all configured assets.</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary"><Icon>history</Icon> Scan History</button>
            <button className="button primary" onClick={() => setShowNew(true)}><Icon>play_arrow</Icon> New Scan</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Total Scans" value={String(metrics.total)} trend="+24 today" trendUp />
          <MetricCard label="Running" value={String(metrics.running)} trend="In progress" trendUp />
          <MetricCard label="Avg Duration" value="2m 18s" trend="-12s from avg" trendUp />
          <MetricCard label="Total Findings" value={String(metrics.findings)} trend="+142 this week" />
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Recent Scans</h2>
            <span className="mono-pill streaming">Live</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Scan ID</th><th>Target</th><th>Type</th><th>Started</th><th>Duration</th><th>Findings</th><th>Status</th></tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id}>
                    <td><code className="text-primary font-bold">{scan.id}</code></td>
                    <td><code>{scan.target}</code></td>
                    <td>{scan.type}</td>
                    <td>{scan.started}</td>
                    <td>{scan.duration}</td>
                    <td><b>{scan.findings}</b></td>
                    <td><span className={`severity-badge ${scan.status === "running" ? "medium" : scan.status === "completed" ? "low" : "critical"}`}>{scan.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Modal open={showNew} onClose={() => setShowNew(false)} title="New Scan">
          <FormField label="Target Repository">
            <select className="v2-select full" value={scanTarget} onChange={e => setScanTarget(e.target.value)}>
              <option value="">Select a repository...</option>
              <option>vault-core/api-gateway</option><option>payments/stripe-integration</option>
              <option>infra/terraform-modules</option><option>auth/oauth-service</option>
              <option>devops/ci-configs</option><option>ml/model-pipeline</option>
            </select>
          </FormField>
          <FormField label="Scan Type">
            <select className="v2-select full" value={scanType} onChange={e => setScanType(e.target.value)}>
              <option>Full Scan</option><option>Quick Scan</option><option>Incremental</option>
            </select>
          </FormField>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="button primary" onClick={startScan}><Icon>play_arrow</Icon> Start Scan</button>
          </div>
        </Modal>
      </main>
    </AppShell>
  )
}

/* ================================================================
   SECRETS / FINDINGS PAGE
   ================================================================ */

const secretsData = [
  { id: "SEC-4821", type: "AWS Access Key", file: "config/prod.env", repo: "vault-core/api-gateway", severity: "critical", status: "Open", detected: "2h ago" },
  { id: "SEC-4820", type: "GitHub PAT", file: ".github/workflows/deploy.yml", repo: "payments/stripe-integration", severity: "high", status: "Triaging", detected: "6h ago" },
  { id: "SEC-4819", type: "Slack Webhook URL", file: "modules/alerts/main.tf", repo: "infra/terraform-modules", severity: "medium", status: "Resolved", detected: "1d ago" },
  { id: "SEC-4818", type: "Database Connection String", file: "src/db/connection.ts", repo: "auth/oauth-service", severity: "critical", status: "Open", detected: "3d ago" },
  { id: "SEC-4817", type: "SSH Private Key", file: "scripts/deploy.sh", repo: "ml/model-pipeline", severity: "high", status: "Triaging", detected: "4d ago" },
  { id: "SEC-4816", type: "GCP Service Account", file: "credentials/gcp-sa.json", repo: "infra/terraform-modules", severity: "critical", status: "Resolved", detected: "5d ago" },
  { id: "SEC-4815", type: "Stripe Secret Key", file: "src/payments/config.ts", repo: "payments/stripe-integration", severity: "high", status: "Open", detected: "6d ago" },
  { id: "SEC-4814", type: "JWT Signing Key", file: "src/auth/jwt.ts", repo: "auth/oauth-service", severity: "medium", status: "Acknowledged", detected: "7d ago" },
]

export function SecretsPage() {
  const [secrets, setSecrets] = useState(secretsData)
  const [sevFilter, setSevFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected, setSelected] = useState(new Set())
  const { show, ToastEl } = useToast()

  const filtered = useMemo(() => {
    let list = secrets
    if (sevFilter !== "all") list = list.filter(s => s.severity === sevFilter)
    if (statusFilter !== "all") list = list.filter(s => s.status === statusFilter)
    return list
  }, [secrets, sevFilter, statusFilter])

  const metrics = useMemo(() => ({
    total: secrets.length,
    critical: secrets.filter(s => s.severity === "critical").length,
    resolved: secrets.filter(s => s.status === "Resolved").length,
    open: secrets.filter(s => s.status === "Open").length,
  }), [secrets])

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.id)))
  }
  function bulkAction(newStatus) {
    setSecrets(prev => prev.map(s => selected.has(s.id) ? { ...s, status: newStatus } : s))
    show(`${selected.size} findings marked as ${newStatus}`, "success")
    setSelected(new Set())
  }
  function exportCSV() {
    const csv = ["ID,Type,File,Repo,Severity,Status,Detected", ...filtered.map(s => `${s.id},${s.type},${s.file},${s.repo},${s.severity},${s.status},${s.detected}`)].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "secrets-export.csv"; a.click()
    show("Exported to CSV", "success")
  }

  return (
    <AppShell active="secrets">
      <main className="content">
        {ToastEl}
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Findings triage</p>
            <h1>Detected Secrets</h1>
            <p>Triage detected secrets by severity, source file, commit context, and status.</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary" onClick={exportCSV}><Icon>download</Icon> Export CSV</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Total Findings" value={String(metrics.total)} trend="+142 this week" />
          <MetricCard label="Critical" value={String(metrics.critical)} trend="Require action" />
          <MetricCard label="Resolved" value={String(metrics.resolved)} trend={`${metrics.total > 0 ? Math.round(metrics.resolved/metrics.total*100) : 0}% resolved`} trendUp />
          <MetricCard label="Avg Resolution" value="4.2d" trend="-0.8d from avg" trendUp />
        </section>

        {selected.size > 0 && (
          <section className="bulk-actions">
            <span>{selected.size} selected</span>
            <button className="button secondary" onClick={() => bulkAction("Resolved")}><Icon>check_circle</Icon> Resolve</button>
            <button className="button secondary" onClick={() => bulkAction("Ignored")}><Icon>visibility_off</Icon> Ignore</button>
            <button className="button secondary" onClick={() => bulkAction("False Positive")}><Icon>flag</Icon> False Positive</button>
          </section>
        )}

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Secret Findings</h2>
            <div className="heading-actions">
              <select className="v2-select" value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
                <option value="all">All Severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option>
              </select>
              <select className="v2-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option><option value="Open">Open</option><option value="Triaging">Triaging</option><option value="Resolved">Resolved</option><option value="Acknowledged">Acknowledged</option>
              </select>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} /></th>
                  <th>Finding ID</th><th>Secret Type</th><th>File</th><th>Repository</th><th>Severity</th><th>Status</th><th>Detected</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className={selected.has(s.id) ? "row-selected" : ""}>
                    <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                    <td><code className="text-primary font-bold">{s.id}</code></td>
                    <td><b>{s.type}</b></td>
                    <td><code>{s.file}</code></td>
                    <td><code>{s.repo}</code></td>
                    <td><SeverityBadge value={s.severity} /></td>
                    <td><span className={`severity-badge ${s.status === "Open" ? "critical" : s.status === "Resolved" ? "low" : "medium"}`}>{s.status}</span></td>
                    <td>{s.detected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   CLOSED LOOP REMEDIATION
   ================================================================ */

const remediationData = [
  { id: "REM-301", secret: "AWS Access Key", repo: "vault-core/api-gateway", status: "Rotating", assignee: "alex.morgan", progress: 60, created: "2h ago" },
  { id: "REM-300", secret: "GitHub PAT", repo: "payments/stripe-integration", status: "Under Review", assignee: "svc-deploy", progress: 40, created: "6h ago" },
  { id: "REM-299", secret: "Slack Webhook", repo: "infra/terraform-modules", status: "Verified", assignee: "jennifer.wu", progress: 100, created: "1d ago" },
  { id: "REM-298", secret: "DB Connection String", repo: "auth/oauth-service", status: "Rotating", assignee: "k8s-admin", progress: 75, created: "3d ago" },
  { id: "REM-297", secret: "GCP SA Key", repo: "infra/terraform-modules", status: "Verified", assignee: "alex.morgan", progress: 100, created: "5d ago" },
]

export function ClosedLoopPage() {
  return (
    <AppShell active="closed-loop">
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Remediation tracking</p>
            <h1>Closed-Loop Remediation</h1>
            <p>Track the full lifecycle from detection through key rotation, code review, and resolution.</p>
          </div>
          <div className="heading-actions">
            <Link className="button secondary" href="/secrets">View Findings</Link>
            <button className="button primary"><Icon>add</Icon> New Remediation</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Active Remediations" value="18" trend="+3 today" />
          <MetricCard label="Avg Time to Resolve" value="3.2d" trend="-1.1d improvement" trendUp />
          <MetricCard label="Verified Rotations" value="847" trend="98.2% success rate" trendUp />
          <MetricCard label="Pending Reviews" value="5" trend="Awaiting approval" />
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Remediation Pipeline</h2>
            <span className="mono-pill">Active</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Remediation ID</th>
                  <th>Secret Type</th>
                  <th>Repository</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Progress</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {remediationData.map((r) => (
                  <tr key={r.id}>
                    <td><code className="text-primary font-bold">{r.id}</code></td>
                    <td><b>{r.secret}</b></td>
                    <td><code>{r.repo}</code></td>
                    <td><SeverityBadge value={r.status === "Verified" ? "low" : r.status === "Rotating" ? "medium" : "high"} /></td>
                    <td>{r.assignee}</td>
                    <td>
                      <div className="mini-progress">
                        <div style={{ width: `${r.progress}%` }} />
                      </div>
                      <small>{r.progress}%</small>
                    </td>
                    <td>{r.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   ML INSIGHTS PAGE
   ================================================================ */

const insightsTrend = [
  { date: "Mon", risk: 72, predicted: 68 },
  { date: "Tue", risk: 78, predicted: 74 },
  { date: "Wed", risk: 65, predicted: 70 },
  { date: "Thu", risk: 82, predicted: 76 },
  { date: "Fri", risk: 90, predicted: 84 },
  { date: "Sat", risk: 74, predicted: 78 },
  { date: "Sun", risk: 68, predicted: 72 },
]

const riskPredictions = [
  { repo: "vault-core/api-gateway", currentRisk: 94, predictedRisk: 88, trend: "decreasing", confidence: "92%" },
  { repo: "payments/stripe-integration", currentRisk: 87, predictedRisk: 91, trend: "increasing", confidence: "88%" },
  { repo: "infra/terraform-modules", currentRisk: 76, predictedRisk: 72, trend: "decreasing", confidence: "95%" },
  { repo: "auth/oauth-service", currentRisk: 68, predictedRisk: 74, trend: "increasing", confidence: "85%" },
]

export function InsightsPage() {
  return (
    <AppShell active="insights">
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> ML-powered analysis</p>
            <h1>Security Insights</h1>
            <p>Surface risk signals and model-assisted prioritization to predict where exposures are likely to occur next.</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary"><Icon>tune</Icon> Model Settings</button>
            <button className="button primary"><Icon>auto_awesome</Icon> Run Analysis</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Risk Score" value="78/100" trend="+4 from last week" />
          <MetricCard label="Predictions Made" value="1,247" trend="Last 30 days" trendUp />
          <MetricCard label="Accuracy" value="91.3%" trend="+2.1% improvement" trendUp />
          <MetricCard label="Anomalies Detected" value="7" trend="3 require review" />
        </section>

        <section className="dashboard-grid">
          <article className="dashboard-card chart-card span-8">
            <div className="card-title-row">
              <div>
                <h2>Risk Trend vs Predicted</h2>
                <p>Actual <b className="text-error">Risk</b> · Model <b className="text-primary">Predicted</b></p>
              </div>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={insightsTrend} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#737686" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#737686" }} axisLine={false} tickLine={false} domain={[50, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="risk" stroke="#ba1a1a" strokeWidth={2} dot={{ r: 3 }} name="Actual Risk" />
                  <Line type="monotone" dataKey="predicted" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Predicted" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="dashboard-card span-4">
            <h2>Risk Predictions</h2>
            <div className="prediction-list">
              {riskPredictions.map((p) => (
                <div className="prediction-item" key={p.repo}>
                  <code>{p.repo.split("/")[1]}</code>
                  <div className="prediction-scores">
                    <span className="current">{p.currentRisk}</span>
                    <Icon>{p.trend === "increasing" ? "trending_up" : "trending_down"}</Icon>
                    <span className="predicted">{p.predictedRisk}</span>
                  </div>
                  <small>{p.confidence} confidence</small>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   REPORTS PAGE
   ================================================================ */

const reportData = [
  { id: "RPT-089", name: "Weekly Security Summary", type: "Full Report", generated: "Today, 10:00 AM", format: "PDF", size: "2.4 MB" },
  { id: "RPT-088", name: "Repository Risk Assessment", type: "Repository", generated: "Yesterday", format: "PDF", size: "1.8 MB" },
  { id: "RPT-087", name: "Scan Results Export", type: "Scan Report", generated: "2 days ago", format: "CSV", size: "456 KB" },
  { id: "RPT-086", name: "Compliance Audit Trail", type: "Audit", generated: "3 days ago", format: "JSON", size: "1.2 MB" },
  { id: "RPT-085", name: "Executive Dashboard", type: "Summary", generated: "1 week ago", format: "PDF", size: "3.1 MB" },
]

export function ReportsPage() {
  return (
    <AppShell active="reports">
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Compliance & reporting</p>
            <h1>Reports</h1>
            <p>Generate full, repository, scan, CSV, JSON, and PDF-style reports for compliance and review.</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary"><Icon>schedule</Icon> Schedule Report</button>
            <button className="button primary"><Icon>add</Icon> Generate Report</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Reports Generated" value="89" trend="This month" trendUp />
          <MetricCard label="Scheduled" value="4" trend="Weekly cadence" />
          <MetricCard label="Exports" value="234" trend="CSV, JSON, PDF" />
          <MetricCard label="Last Generated" value="2h ago" trend="Auto-scheduled" trendUp />
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Generated Reports</h2>
            <span className="mono-pill">{reportData.length} reports</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Generated</th>
                  <th>Format</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r) => (
                  <tr key={r.id}>
                    <td><code className="text-primary font-bold">{r.id}</code></td>
                    <td><b>{r.name}</b></td>
                    <td>{r.type}</td>
                    <td>{r.generated}</td>
                    <td><span className="mono-pill">{r.format}</span></td>
                    <td>{r.size}</td>
                    <td><button className="button secondary" style={{ padding: "4px 8px", minHeight: 28, fontSize: 11 }}><Icon>download</Icon></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   ALERTS PAGE
   ================================================================ */

const alertData = [
  { id: "ALT-892", title: "Critical secret exposed in production", channel: "Slack #security", severity: "critical", time: "2 min ago", read: false },
  { id: "ALT-891", title: "Scan completed: 3 new findings", channel: "Email", severity: "high", time: "14 min ago", read: false },
  { id: "ALT-890", title: "API key rotation reminder", channel: "Webhook", severity: "medium", time: "1h ago", read: true },
  { id: "ALT-889", title: "Weekly compliance report ready", channel: "Email", severity: "low", time: "3h ago", read: true },
  { id: "ALT-888", title: "New repository connected", channel: "Slack #devops", severity: "low", time: "6h ago", read: true },
  { id: "ALT-887", title: "Failed scan: auth/oauth-service", channel: "Webhook", severity: "high", time: "12h ago", read: true },
]

export function AlertsPage() {
  const [alerts, setAlerts] = useState(alertData)
  const [filter, setFilter] = useState("all")
  const { show, ToastEl } = useToast()

  const filtered = useMemo(() => {
    if (filter === "all") return alerts
    if (filter === "unread") return alerts.filter(a => !a.read)
    return alerts.filter(a => a.severity === filter)
  }, [alerts, filter])

  const metrics = useMemo(() => ({
    total: alerts.length,
    unread: alerts.filter(a => !a.read).length,
    critical: alerts.filter(a => a.severity === "critical").length,
  }), [alerts])

  function markRead(id) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
    show("Marked as read", "info")
  }
  function markAllRead() {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
    show("All alerts marked as read", "success")
  }

  return (
    <AppShell active="alerts">
      <main className="content">
        {ToastEl}
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Notification center</p>
            <h1>Alerts</h1>
            <p>Review generated alerts and route security events to Slack, email, and webhook endpoints.</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary" onClick={markAllRead}><Icon>done_all</Icon> Mark All Read</button>
            <button className="button primary"><Icon>add</Icon> Create Rule</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Total Alerts" value={String(metrics.total)} trend="+24 today" />
          <MetricCard label="Unread" value={String(metrics.unread)} trend="Require attention" />
          <MetricCard label="Channels" value="6" trend="Slack, Email, Webhook" />
          <MetricCard label="Avg Response" value="8m" trend="-3m improvement" trendUp />
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Alert Feed</h2>
            <select className="v2-select" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Alerts</option><option value="unread">Unread</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option>
            </select>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Alert ID</th><th>Title</th><th>Channel</th><th>Severity</th><th>Time</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} style={{ fontWeight: a.read ? 400 : 600 }}>
                    <td><code className="text-primary font-bold">{a.id}</code></td>
                    <td>{!a.read && <StatusDot color="var(--primary)" />} {a.title}</td>
                    <td>{a.channel}</td>
                    <td><SeverityBadge value={a.severity} /></td>
                    <td>{a.time}</td>
                    <td>{!a.read && <button className="icon-btn" title="Mark read" onClick={() => markRead(a.id)}><Icon>done</Icon></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   POLICIES PAGE
   ================================================================ */

const policyData = [
  { name: "AWS Key Detection", type: "Pattern", targets: "All repos", severity: "critical", enabled: true, matches: 142 },
  { name: "High Entropy Strings", type: "Entropy", targets: "*.env, *.yml", severity: "high", enabled: true, matches: 89 },
  { name: "Private Key Files", type: "Pattern", targets: "*.pem, *.key", severity: "critical", enabled: true, matches: 23 },
  { name: "Slack Tokens", type: "Pattern", targets: "All repos", severity: "medium", enabled: true, matches: 34 },
  { name: "Custom: Internal API Keys", type: "Custom", targets: "vault-core/*", severity: "high", enabled: false, matches: 12 },
  { name: "Base64 Encoded Secrets", type: "Entropy", targets: "All repos", severity: "medium", enabled: true, matches: 56 },
]

export function PoliciesPage() {
  return (
    <AppShell active="policies">
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Detection rules</p>
            <h1>Policies</h1>
            <p>Manage custom detection patterns, allowlists, and response rules across your organization.</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary"><Icon>upload</Icon> Import Rules</button>
            <button className="button primary"><Icon>add</Icon> Create Policy</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Active Policies" value="24" trend="6 custom rules" />
          <MetricCard label="Pattern Rules" value="18" trend="Regex-based" />
          <MetricCard label="Entropy Rules" value="4" trend="Shannon analysis" />
          <MetricCard label="Total Matches" value="4,892" trend="All time" />
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Detection Policies</h2>
            <span className="mono-pill">{policyData.length} rules</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Policy Name</th><th>Type</th><th>Targets</th><th>Severity</th><th>Status</th><th>Matches</th></tr>
              </thead>
              <tbody>
                {policyData.map((p) => (
                  <tr key={p.name}>
                    <td><b>{p.name}</b></td>
                    <td><span className="mono-pill">{p.type}</span></td>
                    <td><code>{p.targets}</code></td>
                    <td><SeverityBadge value={p.severity} /></td>
                    <td><span className={`severity-badge ${p.enabled ? "low" : "critical"}`}>{p.enabled ? "Enabled" : "Disabled"}</span></td>
                    <td><b>{p.matches}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   INTEGRATIONS PAGE
   ================================================================ */

const integrations = [
  { name: "GitHub", icon: "code", status: "Connected", repos: 32, lastSync: "5 min ago" },
  { name: "GitLab", icon: "code", status: "Connected", repos: 12, lastSync: "1h ago" },
  { name: "Bitbucket", icon: "code", status: "Connected", repos: 4, lastSync: "3h ago" },
  { name: "Slack", icon: "chat", status: "Connected", repos: "—", lastSync: "Real-time" },
  { name: "Jira", icon: "task_alt", status: "Not Connected", repos: "—", lastSync: "—" },
  { name: "PagerDuty", icon: "notifications", status: "Not Connected", repos: "—", lastSync: "—" },
  { name: "Webhook", icon: "webhook", status: "Connected", repos: "3 endpoints", lastSync: "Real-time" },
  { name: "AWS", icon: "cloud", status: "Connected", repos: "8 buckets", lastSync: "30 min ago" },
]

export function IntegrationsPage() {
  return (
    <AppShell active="integrations">
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Connections</p>
            <h1>Integrations</h1>
            <p>Configure Git providers, Slack, Jira, webhooks, and cloud provider connections.</p>
          </div>
          <div className="heading-actions">
            <button className="button primary"><Icon>add</Icon> Add Integration</button>
          </div>
        </section>

        <section className="integration-grid">
          {integrations.map((int) => (
            <article key={int.name} className="feature-card">
              <div className="card-title-row">
                <h2><Icon>{int.icon}</Icon> {int.name}</h2>
                <span className={`severity-badge ${int.status === "Connected" ? "low" : "critical"}`}>{int.status}</span>
              </div>
              <div className="card-copy">
                <p>Repos/Assets: <b>{int.repos}</b></p>
                <p>Last sync: {int.lastSync}</p>
              </div>
            </article>
          ))}
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   TEAMS PAGE
   ================================================================ */

const teamMembers = [
  { name: "Alex Morgan", email: "alex@company.com", role: "Admin", lastActive: "Just now", status: "Active" },
  { name: "Jennifer Wu", email: "jennifer@company.com", role: "Security Lead", lastActive: "5 min ago", status: "Active" },
  { name: "Marcus Chen", email: "marcus@company.com", role: "Developer", lastActive: "1h ago", status: "Active" },
  { name: "Sarah Kim", email: "sarah@company.com", role: "Auditor", lastActive: "3h ago", status: "Active" },
  { name: "David Park", email: "david@company.com", role: "Developer", lastActive: "1d ago", status: "Inactive" },
  { name: "Lisa Johnson", email: "lisa@company.com", role: "Viewer", lastActive: "3d ago", status: "Invited" },
]

export function TeamsPage() {
  const [members, setMembers] = useState(teamMembers)
  const [showInvite, setShowInvite] = useState(false)
  const [invEmail, setInvEmail] = useState("")
  const [invRole, setInvRole] = useState("Developer")
  const { show, ToastEl } = useToast()

  function invite() {
    if (!invEmail.trim() || !invEmail.includes("@")) { show("Enter a valid email", "warning"); return }
    setMembers(prev => [...prev, { name: invEmail.split("@")[0], email: invEmail.trim(), role: invRole, lastActive: "—", status: "Invited" }])
    show(`Invitation sent to ${invEmail}`, "success")
    setShowInvite(false); setInvEmail(""); setInvRole("Developer")
  }

  function removeMember(email) {
    setMembers(prev => prev.filter(m => m.email !== email))
    show("Member removed", "info")
  }

  return (
    <AppShell active="teams">
      <main className="content">
        {ToastEl}
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Workspace access</p>
            <h1>Teams</h1>
            <p>Invite teammates, assign roles, and manage workspace access controls.</p>
          </div>
          <div className="heading-actions">
            <button className="button primary" onClick={() => setShowInvite(true)}><Icon>person_add</Icon> Invite Member</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Team Members" value={String(members.length)} trend={`${members.filter(m => m.status === "Invited").length} pending`} />
          <MetricCard label="Active Now" value={String(members.filter(m => m.status === "Active").length)} trend="Online" trendUp />
          <MetricCard label="Roles" value="5" trend="Admin, Lead, Dev, Auditor, Viewer" />
          <MetricCard label="Pending Invites" value={String(members.filter(m => m.status === "Invited").length)} trend="Awaiting acceptance" />
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Team Members</h2>
            <span className="mono-pill">{members.length} members</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Last Active</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.email}>
                    <td><b>{m.name}</b></td>
                    <td><code>{m.email}</code></td>
                    <td>{m.role}</td>
                    <td>{m.lastActive}</td>
                    <td><span className={`severity-badge ${m.status === "Active" ? "low" : m.status === "Invited" ? "medium" : "high"}`}>{m.status}</span></td>
                    <td><button className="icon-btn danger" title="Remove" onClick={() => removeMember(m.email)}><Icon>person_remove</Icon></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member">
          <FormField label="Email Address">
            <input className="v2-input" type="email" placeholder="teammate@company.com" value={invEmail} onChange={e => setInvEmail(e.target.value)} />
          </FormField>
          <FormField label="Role">
            <select className="v2-select full" value={invRole} onChange={e => setInvRole(e.target.value)}>
              <option>Admin</option><option>Security Lead</option><option>Developer</option><option>Auditor</option><option>Viewer</option>
            </select>
          </FormField>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setShowInvite(false)}>Cancel</button>
            <button className="button primary" onClick={invite}><Icon>send</Icon> Send Invite</button>
          </div>
        </Modal>
      </main>
    </AppShell>
  )
}

/* ================================================================
   API KEYS PAGE
   ================================================================ */

const apiKeyData = [
  { name: "Production Scanner", prefix: "vs_prod_...a8f2", created: "2024-01-15", lastUsed: "2 min ago", scopes: "scan:write, repo:read", status: "Active" },
  { name: "CI/CD Pipeline", prefix: "vs_ci_...b3d1", created: "2024-02-01", lastUsed: "1h ago", scopes: "scan:write", status: "Active" },
  { name: "Monitoring Dashboard", prefix: "vs_mon_...c7e4", created: "2024-03-10", lastUsed: "3d ago", scopes: "read:all", status: "Active" },
  { name: "Dev Testing", prefix: "vs_dev_...d2f8", created: "2024-01-20", lastUsed: "30d ago", scopes: "scan:read", status: "Expired" },
]

export function ApiKeysPage() {
  const [keys, setKeys] = useState(apiKeyData)
  const [showGen, setShowGen] = useState(false)
  const [keyName, setKeyName] = useState("")
  const [keyScopes, setKeyScopes] = useState("scan:read, scan:write")
  const [keyExpiry, setKeyExpiry] = useState("90 days")
  const { show, ToastEl } = useToast()

  function generateKey() {
    if (!keyName.trim()) { show("Key name is required", "warning"); return }
    const prefix = `vs_${keyName.toLowerCase().replace(/\s+/g, "_").slice(0, 4)}_...${Math.random().toString(36).slice(-4)}`
    setKeys(prev => [...prev, { name: keyName.trim(), prefix, created: new Date().toISOString().split("T")[0], lastUsed: "Never", scopes: keyScopes, status: "Active" }])
    show(`API key "${keyName}" generated`, "success")
    setShowGen(false); setKeyName(""); setKeyScopes("scan:read, scan:write"); setKeyExpiry("90 days")
  }

  function revokeKey(prefix) {
    setKeys(prev => prev.map(k => k.prefix === prefix ? { ...k, status: "Revoked" } : k))
    show("API key revoked", "warning")
  }

  return (
    <AppShell active="api-keys">
      <main className="content">
        {ToastEl}
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> API credentials</p>
            <h1>API Keys</h1>
            <p>Create and rotate API credentials for scanner automation and third-party integrations.</p>
          </div>
          <div className="heading-actions">
            <button className="button primary" onClick={() => setShowGen(true)}><Icon>add</Icon> Generate Key</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Active Keys" value={String(keys.filter(k => k.status === "Active").length)} trend="In use" trendUp />
          <MetricCard label="Revoked" value={String(keys.filter(k => k.status !== "Active").length)} trend="Deactivated" />
          <MetricCard label="Total Keys" value={String(keys.length)} trend="All time" />
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>API Keys</h2>
            <span className="mono-pill">{keys.length} keys</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Name</th><th>Key</th><th>Created</th><th>Last Used</th><th>Scopes</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.prefix}>
                    <td><b>{k.name}</b></td>
                    <td><code>{k.prefix}</code></td>
                    <td>{k.created}</td>
                    <td>{k.lastUsed}</td>
                    <td><code style={{ fontSize: 11 }}>{k.scopes}</code></td>
                    <td><span className={`severity-badge ${k.status === "Active" ? "low" : "critical"}`}>{k.status}</span></td>
                    <td>{k.status === "Active" && <button className="icon-btn danger" title="Revoke" onClick={() => revokeKey(k.prefix)}><Icon>block</Icon></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Modal open={showGen} onClose={() => setShowGen(false)} title="Generate API Key">
          <FormField label="Key Name">
            <input className="v2-input" placeholder="e.g. CI/CD Pipeline" value={keyName} onChange={e => setKeyName(e.target.value)} />
          </FormField>
          <FormField label="Scopes">
            <select className="v2-select full" value={keyScopes} onChange={e => setKeyScopes(e.target.value)}>
              <option>scan:read, scan:write</option><option>scan:read</option><option>read:all</option><option>scan:write, repo:read</option><option>scan:write, repo:read, secret:read</option>
            </select>
          </FormField>
          <FormField label="Expiration">
            <select className="v2-select full" value={keyExpiry} onChange={e => setKeyExpiry(e.target.value)}>
              <option>30 days</option><option>90 days</option><option>1 year</option><option>Never</option>
            </select>
          </FormField>
          <p className="form-hint"><Icon>warning</Icon> Never commit API keys to repositories. Use environment variables instead.</p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setShowGen(false)}>Cancel</button>
            <button className="button primary" onClick={generateKey}><Icon>key</Icon> Generate</button>
          </div>
        </Modal>
      </main>
    </AppShell>
  )
}

/* ================================================================
   AUDIT LOGS PAGE
   ================================================================ */

const auditData = [
  { id: "AUD-4821", action: "scan.started", actor: "alex.morgan", target: "vault-core/api-gateway", ip: "10.0.1.24", time: "2 min ago" },
  { id: "AUD-4820", action: "secret.resolved", actor: "jennifer.wu", target: "SEC-4819", ip: "10.0.1.18", time: "15 min ago" },
  { id: "AUD-4819", action: "team.invited", actor: "alex.morgan", target: "lisa@company.com", ip: "10.0.1.24", time: "1h ago" },
  { id: "AUD-4818", action: "api_key.created", actor: "svc-deploy", target: "CI/CD Pipeline", ip: "10.0.2.5", time: "3h ago" },
  { id: "AUD-4817", action: "policy.updated", actor: "alex.morgan", target: "AWS Key Detection", ip: "10.0.1.24", time: "6h ago" },
  { id: "AUD-4816", action: "report.generated", actor: "system", target: "RPT-089", ip: "—", time: "12h ago" },
  { id: "AUD-4815", action: "settings.changed", actor: "alex.morgan", target: "MFA enforcement", ip: "10.0.1.24", time: "1d ago" },
]

export function AuditPage() {
  const [catFilter, setCatFilter] = useState("all")
  const [search, setSearch] = useState("")
  const { show, ToastEl } = useToast()

  const filtered = useMemo(() => {
    let list = auditData
    if (catFilter !== "all") list = list.filter(a => a.action.startsWith(catFilter))
    if (search) list = list.filter(a => `${a.action} ${a.actor} ${a.target}`.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [catFilter, search])

  function exportLogs() {
    const csv = ["ID,Action,Actor,Target,IP,Time", ...filtered.map(a => `${a.id},${a.action},${a.actor},${a.target},${a.ip},${a.time}`)].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "audit-logs.csv"; a.click()
    show("Exported audit logs", "success")
  }

  return (
    <AppShell active="audit">
      <main className="content">
        {ToastEl}
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Activity trail</p>
            <h1>Audit Logs</h1>
            <p>Complete audit trail of every security-relevant workspace event.</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary" onClick={exportLogs}><Icon>download</Icon> Export CSV</button>
          </div>
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Event Log</h2>
            <div className="heading-actions">
              <input className="v2-input" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180 }} />
              <select className="v2-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="all">All Categories</option><option value="scan">Scan</option><option value="secret">Secret</option><option value="team">Team</option><option value="api_key">API Key</option><option value="policy">Policy</option><option value="report">Report</option><option value="settings">Settings</option>
              </select>
              <span className="mono-pill streaming">Real-time</span>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Event ID</th><th>Action</th><th>Actor</th><th>Target</th><th>IP Address</th><th>Time</th></tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td><code className="text-primary font-bold">{a.id}</code></td>
                    <td><span className="mono-pill">{a.action}</span></td>
                    <td>{a.actor}</td>
                    <td><code>{a.target}</code></td>
                    <td><code>{a.ip}</code></td>
                    <td>{a.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   SCHEDULED SCANS PAGE
   ================================================================ */

const scheduledScans = [
  { name: "Nightly Full Scan", schedule: "Every day at 2:00 AM", targets: "All repositories", lastRun: "Today, 2:00 AM", nextRun: "Tomorrow, 2:00 AM", status: "Active" },
  { name: "Weekly Deep Scan", schedule: "Every Monday at 6:00 AM", targets: "vault-core/*, payments/*", lastRun: "Monday", nextRun: "Next Monday", status: "Active" },
  { name: "PR Branch Scan", schedule: "On pull request", targets: "All repos with CI", lastRun: "1h ago", nextRun: "On trigger", status: "Active" },
  { name: "Monthly Compliance", schedule: "1st of month at 9:00 AM", targets: "All repositories + S3", lastRun: "May 1", nextRun: "Jun 1", status: "Active" },
  { name: "Legacy Scan", schedule: "Every Friday at 8:00 PM", targets: "docs/internal-wiki", lastRun: "Last Friday", nextRun: "—", status: "Paused" },
]

export function ScheduledScansPage() {
  const [schedules, setSchedules] = useState(scheduledScans)
  const [showCreate, setShowCreate] = useState(false)
  const [schName, setSchName] = useState("")
  const [schFreq, setSchFreq] = useState("Daily")
  const [schTarget, setSchTarget] = useState("All repositories")
  const { show, ToastEl } = useToast()

  function createSchedule() {
    if (!schName.trim()) { show("Schedule name is required", "warning"); return }
    setSchedules(prev => [...prev, { name: schName.trim(), schedule: `${schFreq}`, targets: schTarget, lastRun: "—", nextRun: "Pending", status: "Active" }])
    show(`Schedule "${schName}" created`, "success")
    setShowCreate(false); setSchName(""); setSchFreq("Daily"); setSchTarget("All repositories")
  }

  function toggleStatus(name) {
    setSchedules(prev => prev.map(s => s.name === name ? { ...s, status: s.status === "Active" ? "Paused" : "Active" } : s))
  }

  function deleteSchedule(name) {
    setSchedules(prev => prev.filter(s => s.name !== name))
    show("Schedule deleted", "info")
  }

  return (
    <AppShell active="scheduled-scans">
      <main className="content">
        {ToastEl}
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Automation</p>
            <h1>Scheduled Scans</h1>
            <p>Set recurring scans for repositories and cloud assets on daily, weekly, or custom schedules.</p>
          </div>
          <div className="heading-actions">
            <button className="button primary" onClick={() => setShowCreate(true)}><Icon>add</Icon> Create Schedule</button>
          </div>
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Scan Schedules</h2>
            <span className="mono-pill">{schedules.length} schedules</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Name</th><th>Schedule</th><th>Targets</th><th>Last Run</th><th>Next Run</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.name}>
                    <td><b>{s.name}</b></td>
                    <td>{s.schedule}</td>
                    <td><code style={{ fontSize: 11 }}>{s.targets}</code></td>
                    <td>{s.lastRun}</td>
                    <td>{s.nextRun}</td>
                    <td><span className={`severity-badge ${s.status === "Active" ? "low" : "medium"}`}>{s.status}</span></td>
                    <td className="action-cell">
                      <button className="icon-btn" title={s.status === "Active" ? "Pause" : "Resume"} onClick={() => toggleStatus(s.name)}>
                        <Icon>{s.status === "Active" ? "pause" : "play_arrow"}</Icon>
                      </button>
                      <button className="icon-btn danger" title="Delete" onClick={() => deleteSchedule(s.name)}>
                        <Icon>delete</Icon>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Scan Schedule">
          <FormField label="Schedule Name">
            <input className="v2-input" placeholder="e.g. Nightly Full Scan" value={schName} onChange={e => setSchName(e.target.value)} />
          </FormField>
          <FormField label="Frequency">
            <select className="v2-select full" value={schFreq} onChange={e => setSchFreq(e.target.value)}>
              <option>Hourly</option><option>Daily</option><option>Weekly</option><option>On pull request</option><option>Monthly</option>
            </select>
          </FormField>
          <FormField label="Targets">
            <select className="v2-select full" value={schTarget} onChange={e => setSchTarget(e.target.value)}>
              <option>All repositories</option><option>All repos with CI</option><option>vault-core/*</option><option>payments/*</option><option>All repositories + S3</option>
            </select>
          </FormField>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="button primary" onClick={createSchedule}><Icon>schedule</Icon> Create</button>
          </div>
        </Modal>
      </main>
    </AppShell>
  )
}

/* ================================================================
   S3 BUCKETS PAGE
   ================================================================ */

const AWS_REGIONS = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "ap-south-1", "ap-southeast-1", "ap-southeast-2", "eu-west-1", "eu-west-2", "eu-central-1"]

const s3Initial = [
  { id: 1, name: "finance-prod-data", region: "us-east-1", objects: "12,400", lastScan: "2h ago", secrets: 3, access: "Private", status: "scanned" },
  { id: 2, name: "app-config-backups", region: "us-west-2", objects: "840", lastScan: "6h ago", secrets: 1, access: "Private", status: "scanned" },
  { id: 3, name: "ci-artifacts-store", region: "eu-west-1", objects: "45,200", lastScan: "1d ago", secrets: 0, access: "Private", status: "clean" },
  { id: 4, name: "public-assets-cdn", region: "us-east-1", objects: "8,900", lastScan: "3d ago", secrets: 0, access: "Public", status: "clean" },
  { id: 5, name: "log-archive-2024", region: "us-east-2", objects: "234,000", lastScan: "Never", secrets: 0, access: "Private", status: "pending" },
]

export function S3BucketsPage() {
  const [buckets, setBuckets] = useState(s3Initial)
  const [showAdd, setShowAdd] = useState(false)
  const [scanning, setScanning] = useState(new Set())
  const [name, setName] = useState("")
  const [region, setRegion] = useState("us-east-1")
  const [accessKey, setAccessKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [pathPrefix, setPathPrefix] = useState("")
  const { show, ToastEl } = useToast()

  const metrics = useMemo(() => ({
    total: buckets.length,
    scanned: buckets.filter(b => b.status !== "pending").length,
    secrets: buckets.reduce((s, b) => s + (b.secrets || 0), 0),
    public: buckets.filter(b => b.access === "Public").length,
  }), [buckets])

  function addBucket() {
    if (!name.trim()) { show("Bucket name is required", "warning"); return }
    if (!/^[a-z0-9.\-]{3,63}$/.test(name.trim())) { show("Name must be 3-63 chars, lowercase letters, numbers, dots, hyphens", "error"); return }
    const newBucket = { id: Date.now(), name: name.trim(), region, objects: "0", lastScan: "Never", secrets: 0, access: "Private", status: "pending" }
    setBuckets(prev => [...prev, newBucket])
    show(`Added s3://${name.trim()}`, "success")
    setShowAdd(false); setName(""); setRegion("us-east-1"); setAccessKey(""); setSecretKey(""); setPathPrefix("")
  }

  function scanBucket(id) {
    setScanning(prev => new Set(prev).add(id))
    setTimeout(() => {
      setBuckets(prev => prev.map(b => b.id === id ? { ...b, lastScan: "Just now", status: "scanned", secrets: Math.floor(Math.random() * 4) } : b))
      setScanning(prev => { const n = new Set(prev); n.delete(id); return n })
      show("Scan completed", "success")
    }, 1500)
  }

  function scanAll() {
    buckets.forEach(b => scanBucket(b.id))
  }

  function removeBucket(id) {
    setBuckets(prev => prev.filter(b => b.id !== id))
    show("Bucket removed", "info")
  }

  return (
    <AppShell active="s3-buckets">
      <main className="content">
        {ToastEl}
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Cloud scanning</p>
            <h1>S3 Buckets</h1>
            <p>Scan AWS S3 buckets for leaked credentials. Configure a bucket once, then run scans on demand or on a schedule.</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary" onClick={scanAll} disabled={buckets.length === 0}><Icon>radar</Icon> Scan All</button>
            <button className="button primary" onClick={() => setShowAdd(true)}><Icon>add</Icon> Add Bucket</button>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Buckets" value={String(metrics.total)} trend="Connected" />
          <MetricCard label="Scanned" value={String(metrics.scanned)} trend={`${metrics.total - metrics.scanned} pending`} trendUp />
          <MetricCard label="Secrets Found" value={String(metrics.secrets)} trend={`In ${buckets.filter(b => b.secrets > 0).length} buckets`} />
          <MetricCard label="Public Buckets" value={String(metrics.public)} trend={metrics.public > 0 ? "Review access" : "All private"} />
        </section>

        <section className="table-card dashboard-table">
          <div className="card-title-row">
            <h2>Connected Buckets</h2>
            <span className="mono-pill">{buckets.length} buckets</span>
          </div>
          {buckets.length === 0 ? (
            <EmptyState icon="cloud" title="No buckets connected" desc="Add an S3 bucket to start scanning for exposed secrets." actionLabel="Add Bucket" actionHref="#" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Bucket Name</th><th>Region</th><th>Objects</th><th>Last Scan</th><th>Secrets</th><th>Access</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {buckets.map((b) => (
                    <tr key={b.id}>
                      <td><Icon>cloud</Icon> <code>{b.name}</code></td>
                      <td>{b.region}</td>
                      <td>{b.objects}</td>
                      <td>{b.lastScan}</td>
                      <td><b className={b.secrets > 0 ? "text-error" : ""}>{b.secrets}</b></td>
                      <td><span className={`severity-badge ${b.access === "Public" ? "critical" : "low"}`}>{b.access}</span></td>
                      <td className="action-cell">
                        <button className="icon-btn" title="Scan" onClick={() => scanBucket(b.id)} disabled={scanning.has(b.id)}>
                          <Icon>{scanning.has(b.id) ? "hourglass_top" : "radar"}</Icon>
                        </button>
                        <button className="icon-btn danger" title="Remove" onClick={() => removeBucket(b.id)}>
                          <Icon>delete</Icon>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add S3 Bucket">
          <FormField label="Bucket Name">
            <input className="v2-input" placeholder="my-bucket-name" value={name} onChange={e => setName(e.target.value)} />
          </FormField>
          <FormField label="AWS Region">
            <select className="v2-select full" value={region} onChange={e => setRegion(e.target.value)}>
              {AWS_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <FormField label="Access Key ID (optional)">
            <input className="v2-input" placeholder="AKIA..." value={accessKey} onChange={e => setAccessKey(e.target.value)} />
          </FormField>
          <FormField label="Secret Access Key (optional)">
            <input className="v2-input" type="password" placeholder="••••••••" value={secretKey} onChange={e => setSecretKey(e.target.value)} />
          </FormField>
          <FormField label="Path Prefix (optional)">
            <input className="v2-input" placeholder="logs/2024/" value={pathPrefix} onChange={e => setPathPrefix(e.target.value)} />
          </FormField>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="button primary" onClick={addBucket}><Icon>add</Icon> Add Bucket</button>
          </div>
        </Modal>
      </main>
    </AppShell>
  )
}

/* ================================================================
   PRICING PAGE
   ================================================================ */

const plans = [
  { name: "Free", price: "0", period: "/month", features: ["5 repositories", "100 scans/month", "Basic detection patterns", "Email alerts", "1 team member"], cta: "Current Plan", current: true },
  { name: "Pro", price: "29", period: "/month", features: ["Unlimited repositories", "Unlimited scans", "Advanced patterns + entropy", "Slack + webhook alerts", "10 team members", "CSV/JSON exports", "API access"], cta: "Upgrade to Pro", current: false },
  { name: "Enterprise", price: "99", period: "/month", features: ["Everything in Pro", "Custom detection rules", "ML-powered insights", "SSO / SAML", "Unlimited team members", "PDF compliance reports", "Priority support", "Audit logs"], cta: "Upgrade to Enterprise", current: false },
]

export function PricingPage() {
  return (
    <AppShell active="pricing">
      <main className="content">
        <section className="page-heading" style={{ textAlign: "center", display: "block" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}><span className="status-dot" /> Plans & Pricing</p>
          <h1>Choose your security tier.</h1>
          <p style={{ maxWidth: 560, margin: "8px auto 0" }}>Scale your secret detection from individual projects to enterprise-wide security governance.</p>
        </section>

        <section className="pricing-grid">
          {plans.map((plan) => (
            <article key={plan.name} className={`pricing-card ${plan.current ? "current" : ""}`}>
              <h2>{plan.name}</h2>
              <div className="pricing-amount">
                <strong>${plan.price}</strong>
                <span>{plan.period}</span>
              </div>
              <ul className="pricing-features">
                {plan.features.map((f) => (
                  <li key={f}><Icon>check_circle</Icon> {f}</li>
                ))}
              </ul>
              <Link className={`button ${plan.current ? "secondary" : "primary"} full`} href={plan.current ? "#" : "/checkout"}>
                {plan.cta}
              </Link>
            </article>
          ))}
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   SETTINGS PAGE
   ================================================================ */

export function SettingsPage() {
  return (
    <AppShell active="settings">
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Configuration</p>
            <h1>Settings</h1>
            <p>Update workspace preferences, security settings, and notification configurations.</p>
          </div>
        </section>

        <section className="settings-grid">
          <FeatureCard title="General" icon="settings">
            <p>Workspace name, timezone, default scan settings, and data retention policies.</p>
          </FeatureCard>
          <FeatureCard title="Security" icon="security">
            <p>MFA enforcement, session timeout, IP allowlisting, and password policies.</p>
          </FeatureCard>
          <FeatureCard title="Notifications" icon="notifications">
            <p>Email digest frequency, Slack channel routing, webhook retry settings.</p>
          </FeatureCard>
          <FeatureCard title="Scan Defaults" icon="radar">
            <p>Default scan depth, file exclusions, severity thresholds, and auto-remediation triggers.</p>
          </FeatureCard>
          <FeatureCard title="Billing" icon="credit_card">
            <p>Subscription plan, payment method, invoices, and usage metrics.</p>
          </FeatureCard>
          <FeatureCard title="Danger Zone" icon="warning">
            <p>Delete workspace, revoke all API keys, disconnect all integrations.</p>
          </FeatureCard>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   PROFILE, SUPPORT, HELP PAGES
   ================================================================ */

export function ProfilePage() {
  return (
    <AppShell active="profile">
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Account</p>
            <h1>Profile</h1>
            <p>Manage your account details, security preferences, and connected sessions.</p>
          </div>
        </section>
        <section className="settings-grid">
          <FeatureCard title="Personal Information" icon="person">
            <p>Name, email address, avatar, and timezone preferences.</p>
          </FeatureCard>
          <FeatureCard title="Security" icon="lock">
            <p>Password, MFA setup, active sessions, and trusted devices.</p>
          </FeatureCard>
          <FeatureCard title="Notifications" icon="notifications">
            <p>Email preferences, alert routing, and digest frequency.</p>
          </FeatureCard>
        </section>
      </main>
    </AppShell>
  )
}

export function SupportPage() {
  return (
    <AppShell active="support">
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Get help</p>
            <h1>Support</h1>
            <p>Send support requests, report issues, and access priority assistance.</p>
          </div>
        </section>
        <section className="feature-grid">
          <FeatureCard title="Submit a Ticket" icon="confirmation_number">
            <p>Describe your issue and our security team will respond within 24 hours.</p>
          </FeatureCard>
          <FeatureCard title="Knowledge Base" icon="menu_book">
            <p>Search our documentation for guides, FAQs, and troubleshooting articles.</p>
          </FeatureCard>
          <FeatureCard title="Community" icon="forum">
            <p>Join the VaultSentry community for discussions and best practices.</p>
          </FeatureCard>
        </section>
      </main>
    </AppShell>
  )
}

export function HelpPage() {
  return (
    <AppShell active="help">
      <main className="content">
        <section className="page-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Documentation</p>
            <h1>Help Center</h1>
            <p>Product guidance, getting started guides, and platform documentation.</p>
          </div>
        </section>
        <section className="feature-grid">
          <FeatureCard title="Getting Started" icon="rocket_launch">
            <ol className="steps">
              <li>Connect your first repository</li>
              <li>Run your first scan</li>
              <li>Review and triage findings</li>
              <li>Set up alerts and integrations</li>
            </ol>
          </FeatureCard>
          <FeatureCard title="API Documentation" icon="api">
            <p>RESTful API reference for scanner automation, data export, and third-party integrations.</p>
          </FeatureCard>
          <FeatureCard title="Security Best Practices" icon="shield">
            <p>Guidelines for secret rotation, access control, and compliance workflows.</p>
          </FeatureCard>
        </section>
      </main>
    </AppShell>
  )
}

/* ================================================================
   CHOOSE PLAN PAGE
   ================================================================ */

export function ChoosePlanPage() {
  return <PricingPage />
}

/* ================================================================
   HELPERS
   ================================================================ */

function activityIcon(type) {
  return { critical: "warning", warning: "report", resolved: "check_circle", info: "info" }[type]
}

function activityLabel(type) {
  return { critical: "CRITICAL", warning: "WARNING", resolved: "RESOLVED", info: "INFO" }[type]
}

function getRelated(slug) {
  if (["repositories", "s3-buckets", "scheduled-scans"].includes(slug))
    return allFeatures.filter((item) => ["repositories", "scans", "secrets", "reports", "scheduled-scans"].includes(item.slug))
  if (["teams", "api-keys", "audit", "settings"].includes(slug))
    return allFeatures.filter((item) => ["teams", "api-keys", "audit", "settings", "support"].includes(item.slug))
  return allFeatures.filter((item) => ["dashboard", "repositories", "scans", "secrets", "reports", "alerts"].includes(item.slug))
}
