'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import {
  Shield, Search, Bell, Settings, ChevronDown, ExternalLink,
  GitBranch, AlertTriangle, CheckCircle2, Clock, Eye, TrendingUp,
  TrendingDown, BarChart3, Activity, Layers, Lock, Zap,
  Server, Users, Workflow, ArrowUpRight, CircleDot, FileWarning,
  LayoutDashboard, User, Crosshair, Plug, UserCircle, Group,
  KeyRound, ScrollText, AppWindow, ShieldCheck, Fingerprint,
} from 'lucide-react'

const C = {
  bg: '#0B0F14',
  surface: '#12171E',
  surfaceHover: '#171D26',
  border: 'rgba(255,255,255,0.06)',
  borderCard: 'rgba(255,255,255,0.05)',
  text: '#E2E8F0',
  textSecondary: '#94A3B8',
  textMuted: '#4B5563',
  purple: '#A855F7',
  purpleDim: '#7C3AED',
  magenta: '#D946EF',
  pink: '#EC4899',
  blue: '#3B82F6',
  cyan: '#06B6D4',
  green: '#22C55E',
  amber: '#F59E0B',
  red: '#EF4444',
  orange: '#F97316',
}

// ─── Chart data ─────────────────────────────────────────────────────────
const chartDataFull = [
  { date: '15 Oct', resolved: 28000, new: 18000 },
  { date: '16 Oct', resolved: 32000, new: 22000 },
  { date: '17 Oct', resolved: 26000, new: 15000 },
  { date: '18 Oct', resolved: 35000, new: 20000 },
  { date: '19 Oct', resolved: 42000, new: 28000 },
  { date: '20 Oct', resolved: 38000, new: 24000 },
  { date: '21 Oct', resolved: 30000, new: 18000 },
  { date: '22 Oct', resolved: 34000, new: 22000 },
  { date: '23 Oct', resolved: 28000, new: 16000 },
  { date: '24 Oct', resolved: 36000, new: 20000 },
  { date: '25 Oct', resolved: 44000, new: 30000 },
  { date: '26 Oct', resolved: 40000, new: 25000 },
]

// Coverage providers
const coverageProviders = [
  { name: 'AWS', abbr: 'aws', color: '#FF9900' },
  { name: 'Okta', abbr: 'O', color: '#00297A' },
  { name: 'Google', abbr: 'G', color: '#4285F4' },
  { name: 'Slack', abbr: '#', color: '#E01E5A' },
]
const identityProviders = [
  { name: 'Okta', abbr: 'O', color: '#00297A' },
  { name: 'AWS', abbr: 'aws', color: '#FF9900' },
  { name: 'Slack', abbr: '#', color: '#E01E5A' },
  { name: 'Adobe', abbr: 'A', color: '#FF0000' },
]
const applications = [
  { name: 'Okta', abbr: 'O', color: '#00297A' },
  { name: 'AWS', abbr: 'aws', color: '#FF9900' },
  { name: 'Google', abbr: 'G', color: '#4285F4' },
]

// Threats coverage stats
const threatsCoverageStats = [
  { icon: Users, label: 'Users', value: 275 },
  { icon: Group, label: 'Groups', value: 138 },
  { icon: KeyRound, label: 'Roles', value: 510 },
  { icon: ScrollText, label: 'Policies', value: 565 },
  { icon: AppWindow, label: 'Applications', value: 103 },
  { icon: ShieldCheck, label: 'Roles', value: 255 },
]

// Heatmap data (weekly / tactic-based)
const heatmapTactics = [
  'Collection',
  'Credential Access',
  'Defense Evasion',
  'Denial of Service',
  'Discovery',
  'Execution',
  'Initial Access',
  'Lateral Movement',
]
const heatmapWeeks = ['15 Oct', '16 Oct', '17 Oct', '18 Oct', '19 Oct']
const heatmapValues = [
  [0, 0, 1, 0, 0],
  [0, 0, 2, 1, 0],
  [0, 1, 0, 0, 0],
  [2, 3, 4, 3, 2],
  [3, 4, 5, 4, 3],
  [1, 2, 3, 2, 1],
  [2, 3, 2, 0, 0],
  [0, 2, 1, 0, 0],
]

// Radar data
const radarData = [
  { axis: 'Discovery', value: 85 },
  { axis: 'Initial Access', value: 72 },
  { axis: 'Execution', value: 90 },
  { axis: 'Privilege\nEscalation', value: 65 },
  { axis: 'Defense Evasion', value: 78 },
  { axis: 'Persistence', value: 58 },
  { axis: 'Lateral\nMovement', value: 70 },
  { axis: 'Exfiltration', value: 62 },
]

// Privileged users at risk
const privilegedUsers = [
  { name: 'aws', platform: 'AWS', score: 10, severity: 'critical' as const, roles: 'Admin, DevOps' },
  { name: 'alex.morgan', platform: 'Okta', score: 8, severity: 'high' as const, roles: 'Super Admin' },
  { name: 'svc-deploy', platform: 'GitHub', score: 7, severity: 'high' as const, roles: 'CI/CD Pipeline' },
  { name: 'jennifer.wu', platform: 'GCP', score: 6, severity: 'medium' as const, roles: 'Project Owner' },
  { name: 'root-access', platform: 'AWS', score: 9, severity: 'critical' as const, roles: 'Root Account' },
  { name: 'k8s-admin', platform: 'Azure', score: 5, severity: 'medium' as const, roles: 'Cluster Admin' },
]

// Activity feed
const activityFeed = [
  { id: 1, type: 'critical' as const, message: 'AWS Access Key exposed in', repo: 'vault-core/api-gateway', file: 'config/prod.env', time: '2 min ago' },
  { id: 2, type: 'warning' as const, message: 'GitHub PAT detected in', repo: 'payments/stripe-integration', file: '.github/workflows/deploy.yml', time: '14 min ago' },
  { id: 3, type: 'resolved' as const, message: 'Slack webhook token revoked in', repo: 'infra/terraform-modules', file: 'modules/alerts/main.tf', time: '28 min ago' },
  { id: 4, type: 'critical' as const, message: 'Database connection string found in', repo: 'auth/oauth-service', file: 'src/db/connection.ts', time: '45 min ago' },
  { id: 5, type: 'info' as const, message: 'SSH private key pattern matched in', repo: 'ml/model-pipeline', file: 'scripts/deploy.sh', time: '1h ago' },
  { id: 6, type: 'resolved' as const, message: 'GCP service account key rotated in', repo: 'infra/terraform-modules', file: 'credentials/', time: '1.5h ago' },
]

// Repository risk data
const repositoryRisks = [
  { name: 'vault-core/api-gateway', score: 94, secrets: 12, age: '2h', contributorRisk: 'critical' as const },
  { name: 'payments/stripe-integration', score: 87, secrets: 8, age: '6h', contributorRisk: 'high' as const },
  { name: 'infra/terraform-modules', score: 76, secrets: 5, age: '1d', contributorRisk: 'high' as const },
  { name: 'auth/oauth-service', score: 68, secrets: 4, age: '3d', contributorRisk: 'medium' as const },
  { name: 'frontend/dashboard-app', score: 45, secrets: 2, age: '5d', contributorRisk: 'low' as const },
]

// ─── Custom tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1A1F28',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: C.textMuted, fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i > 0 ? 3 : 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color }} />
          <span style={{ color: C.textSecondary, fontSize: 11 }}>{p.name}:</span>
          <span style={{ color: C.text, fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
            {(p.value / 1000).toFixed(0)}k
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Provider circle badge ──────────────────────────────────────────────
function ProviderBadge({ abbr, color }: { abbr: string; color: string }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
      style={{
        background: `${color}18`,
        border: `1.5px solid ${color}40`,
        color: color,
      }}
    >
      {abbr}
    </div>
  )
}

// ─── Card wrapper ───────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{
        background: C.surface,
        border: `1px solid ${C.borderCard}`,
      }}
    >
      {children}
    </div>
  )
}

// ─── Main dashboard ─────────────────────────────────────────────────────
export default function TheVaultSentryDashboard() {
  const [dateRange, setDateRange] = useState<'1D' | '1W' | '1M' | '1Y'>('1W')

  const filteredChartData = useMemo(() => {
    switch (dateRange) {
      case '1D': return chartDataFull.slice(-3)
      case '1W': return chartDataFull
      case '1M': return chartDataFull
      case '1Y': return chartDataFull
      default: return chartDataFull
    }
  }, [dateRange])

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ═══ TOP NAV ═══════════════════════════════════════════════════ */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-5 h-[56px]"
        style={{
          background: 'rgba(11,15,20,0.9)',
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #C026D3, #7C3AED)', boxShadow: '0 0 20px rgba(192,38,211,0.3)' }}
            >
              <Shield size={15} color="#fff" strokeWidth={2.5} />
            </div>
          </div>

          {/* Pill nav tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {[
              { label: 'Dashboard', icon: LayoutDashboard, active: true },
              { label: 'User', icon: User, active: false },
              { label: 'Exposures', icon: CircleDot, active: false },
              { label: 'Threats', icon: Crosshair, active: false },
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.label}
                  className="flex items-center gap-1.5 px-3.5 py-[6px] rounded-lg text-[13px] font-medium transition-all duration-200"
                  style={{
                    color: tab.active ? '#fff' : C.textMuted,
                    background: tab.active ? 'rgba(168,85,247,0.2)' : 'transparent',
                    border: tab.active ? '1px solid rgba(168,85,247,0.15)' : '1px solid transparent',
                  }}
                >
                  <Icon size={14} strokeWidth={tab.active ? 2 : 1.5} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2.5">
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}
          >
            <Search size={15} color={C.textMuted} />
          </button>
          <button
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}
          >
            <Bell size={15} color={C.textMuted} />
          </button>
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}
          >
            <Settings size={15} color={C.textMuted} />
          </button>
          <div className="w-px h-6 mx-1" style={{ background: C.border }} />
          <button className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl transition-colors hover:bg-white/5">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-semibold"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #C026D3)', color: '#fff' }}
            >
              AR
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[12px] font-medium leading-tight" style={{ color: C.text }}>Alex Rock</p>
              <p className="text-[10px] leading-tight" style={{ color: C.textMuted }}>alex24y@</p>
            </div>
          </button>
        </div>
      </nav>

      {/* ═══ MAIN CONTENT ══════════════════════════════════════════════ */}
      <div className="max-w-[1400px] mx-auto px-5 py-5 space-y-5">

        {/* ─── ROW 1: Chart + Coverage ─────────────────────────────── */}
        <div className="grid grid-cols-12 gap-5">
          {/* Exposure chart */}
          <Card className="col-span-12 lg:col-span-8 !p-0 overflow-hidden">
            <div className="p-5 pb-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[13px]" style={{ color: C.textSecondary }}>Open and resolved exposures overtime</p>
                  <div className="flex items-center gap-5 mt-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: C.pink }} />
                      <span className="text-[13px] font-semibold" style={{ color: C.text }}>Resolved</span>
                      <span className="text-[13px] font-bold" style={{ color: C.text }}>45</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: C.purple }} />
                      <span className="text-[13px] font-semibold" style={{ color: C.text }}>New</span>
                      <span className="text-[13px] font-bold" style={{ color: C.text }}>38</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
                  {(['1D', '1W', '1M', '1Y'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setDateRange(r)}
                      className="px-3 py-1 rounded-md text-[12px] font-medium transition-all duration-200"
                      style={{
                        color: dateRange === r ? C.text : C.textMuted,
                        background: dateRange === r ? 'rgba(255,255,255,0.08)' : 'transparent',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[240px] px-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-resolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.pink} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={C.pink} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-new" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.purple} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={C.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: C.textMuted }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: C.textMuted }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="resolved"
                    stroke={C.pink}
                    strokeWidth={2}
                    fill="url(#grad-resolved)"
                    name="Resolved"
                    dot={false}
                    activeDot={{ r: 4, fill: C.pink, stroke: C.bg, strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="new"
                    stroke={C.purple}
                    strokeWidth={1.5}
                    fill="url(#grad-new)"
                    name="New"
                    dot={false}
                    activeDot={{ r: 4, fill: C.purple, stroke: C.bg, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Coverage panel */}
          <Card className="col-span-12 lg:col-span-4">
            <h3 className="text-[15px] font-semibold mb-5" style={{ color: C.text }}>Coverage</h3>

            {[
              { title: 'Coverage providers', items: coverageProviders, overflow: 8 },
              { title: 'Identity providers', items: identityProviders, overflow: 5 },
              { title: 'Applications', items: applications, overflow: 9 },
            ].map((section, si) => (
              <div key={si} className={si > 0 ? 'mt-4' : ''}>
                <p className="text-[11px] font-medium mb-2.5" style={{ color: C.textMuted }}>{section.title}</p>
                <div className="flex items-center gap-2.5">
                  {section.items.map((p, i) => (
                    <ProviderBadge key={i} abbr={p.abbr} color={p.color} />
                  ))}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                    style={{ background: 'rgba(168,85,247,0.1)', border: `1.5px solid rgba(168,85,247,0.25)`, color: C.purple }}
                  >
                    +{section.overflow}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* ─── ROW 2: Threats Coverage + Heatmap + Radar ───────────── */}
        <div className="grid grid-cols-12 gap-5">
          {/* Threats Coverage list */}
          <Card className="col-span-12 md:col-span-4 lg:col-span-3">
            <h3 className="text-[15px] font-semibold mb-5" style={{ color: C.text }}>Threats Coverage</h3>
            <div className="space-y-1">
              {threatsCoverageStats.map((item, idx) => {
                const Icon = item.icon
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2.5 px-2 rounded-lg transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(168,85,247,0.08)' }}
                      >
                        <Icon size={15} color={C.purple} strokeWidth={1.5} />
                      </div>
                      <span className="text-[13px] font-medium" style={{ color: C.textSecondary }}>{item.label}</span>
                    </div>
                    <span
                      className="text-[14px] font-semibold tabular-nums"
                      style={{ color: C.text }}
                    >
                      {item.value}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Threats Tactics Heatmap */}
          <Card className="col-span-12 md:col-span-4 lg:col-span-5">
            <h3 className="text-[15px] font-semibold mb-1" style={{ color: C.text }}>Threats Tactics (Last 12 Weeks)</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
                <thead>
                  <tr>
                    <th className="w-32" />
                    {heatmapWeeks.map(w => (
                      <th key={w} className="pb-2 text-center">
                        <span className="text-[9px] font-medium" style={{ color: C.textMuted }}>{w}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapTactics.map((tactic, ri) => (
                    <tr key={tactic}>
                      <td className="pr-2 py-0">
                        <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: C.textMuted }}>{tactic}</span>
                      </td>
                      {heatmapValues[ri].map((val, ci) => {
                        const maxVal = 5
                        const intensity = val / maxVal
                        return (
                          <td key={ci} className="p-[2px]">
                            <div
                              className="w-full h-7 rounded-md transition-all duration-200 hover:scale-110 cursor-default"
                              style={{
                                background: val === 0
                                  ? 'rgba(255,255,255,0.02)'
                                  : `rgba(168,85,247,${0.12 + intensity * 0.6})`,
                                border: val === 0
                                  ? '1px solid rgba(255,255,255,0.03)'
                                  : `1px solid rgba(168,85,247,${0.1 + intensity * 0.2})`,
                                boxShadow: val >= 4 ? '0 0 8px rgba(168,85,247,0.2)' : 'none',
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Threats Coverage Radar */}
          <Card className="col-span-12 md:col-span-4 lg:col-span-4">
            <h3 className="text-[15px] font-semibold mb-1" style={{ color: C.text }}>Threats Coverage</h3>
            <div className="h-[250px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fontSize: 9, fill: C.textMuted }}
                  />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar
                    name="Threats coverage"
                    dataKey="value"
                    stroke={C.pink}
                    strokeWidth={1.5}
                    fill={C.pink}
                    fillOpacity={0.12}
                    dot={{ r: 2.5, fill: C.pink, stroke: 'none' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-2 -mt-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: C.pink }} />
              <span className="text-[11px] font-medium" style={{ color: C.textSecondary }}>Threats coverage</span>
            </div>
          </Card>
        </div>

        {/* ─── ROW 3: Privileged Users at Risk (two panels) ────────── */}
        <div className="grid grid-cols-12 gap-5">
          <Card className="col-span-12 lg:col-span-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold" style={{ color: C.text }}>Privileged Users at risk</h3>
              <div className="flex items-center gap-3">
                {[
                  { label: 'Low', color: C.purple },
                  { label: 'Medium', color: C.amber },
                  { label: 'High', color: C.green },
                  { label: 'Critical', color: C.pink },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    <span className="text-[10px]" style={{ color: C.textMuted }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-0">
              {privilegedUsers.slice(0, 3).map((user, idx) => {
                const sevColors = {
                  critical: { bg: 'rgba(236,72,153,0.1)', color: C.pink, border: 'rgba(236,72,153,0.2)' },
                  high: { bg: 'rgba(34,197,94,0.1)', color: C.green, border: 'rgba(34,197,94,0.2)' },
                  medium: { bg: 'rgba(245,158,11,0.1)', color: C.amber, border: 'rgba(245,158,11,0.2)' },
                  low: { bg: 'rgba(168,85,247,0.1)', color: C.purple, border: 'rgba(168,85,247,0.2)' },
                }
                const sev = sevColors[user.severity]
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-3 px-1"
                    style={{ borderBottom: idx < 2 ? `1px solid ${C.border}` : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
                        <span className="text-[9px] font-bold" style={{ color: C.textMuted }}>{user.platform}</span>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: C.text, fontFamily: 'JetBrains Mono, monospace' }}>{user.name}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: C.textMuted }}>{user.roles}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${user.score * 10}%`, background: sev.color }} />
                      </div>
                      <span
                        className="text-[11px] font-semibold tabular-nums w-5 text-right"
                        style={{ color: sev.color, fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {user.score}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold" style={{ color: C.text }}>Privileged Users at risk</h3>
            </div>
            <div className="space-y-0">
              {privilegedUsers.slice(3).map((user, idx) => {
                const sevColors = {
                  critical: { bg: 'rgba(236,72,153,0.1)', color: C.pink, border: 'rgba(236,72,153,0.2)' },
                  high: { bg: 'rgba(34,197,94,0.1)', color: C.green, border: 'rgba(34,197,94,0.2)' },
                  medium: { bg: 'rgba(245,158,11,0.1)', color: C.amber, border: 'rgba(245,158,11,0.2)' },
                  low: { bg: 'rgba(168,85,247,0.1)', color: C.purple, border: 'rgba(168,85,247,0.2)' },
                }
                const sev = sevColors[user.severity]
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-3 px-1"
                    style={{ borderBottom: idx < 2 ? `1px solid ${C.border}` : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
                        <span className="text-[9px] font-bold" style={{ color: C.textMuted }}>{user.platform}</span>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: C.text, fontFamily: 'JetBrains Mono, monospace' }}>{user.name}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: C.textMuted }}>{user.roles}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${user.score * 10}%`, background: sev.color }} />
                      </div>
                      <span
                        className="text-[11px] font-semibold tabular-nums w-5 text-right"
                        style={{ color: sev.color, fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {user.score}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ─── ROW 4: Repository Risk Table ────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: C.text }}>Repository Risk Assessment</h3>
              <p className="text-[11px] mt-1" style={{ color: C.textMuted }}>Ranked by composite risk score</p>
            </div>
            <button
              className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: C.textSecondary, border: `1px solid ${C.border}` }}
            >
              <ExternalLink size={11} />
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Repository', 'Risk Score', 'Secrets Found', 'Exposure Age', 'Contributor Risk'].map(h => (
                    <th key={h} className="text-left pb-3 pr-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {repositoryRisks.map((repo, idx) => {
                  const scoreColor = repo.score >= 80 ? C.red : repo.score >= 60 ? C.orange : repo.score >= 40 ? C.amber : C.green
                  const badgeColors: Record<string, { bg: string; color: string }> = {
                    critical: { bg: 'rgba(239,68,68,0.1)', color: C.red },
                    high: { bg: 'rgba(249,115,22,0.1)', color: C.orange },
                    medium: { bg: 'rgba(245,158,11,0.1)', color: C.amber },
                    low: { bg: 'rgba(34,197,94,0.1)', color: C.green },
                  }
                  const badge = badgeColors[repo.contributorRisk]
                  return (
                    <tr
                      key={repo.name}
                      className="group transition-colors hover:bg-white/[0.015]"
                      style={{ borderBottom: idx < repositoryRisks.length - 1 ? `1px solid ${C.border}` : 'none' }}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <GitBranch size={13} color={C.textMuted} />
                          <span className="text-[12px] font-medium" style={{ color: C.text, fontFamily: 'JetBrains Mono, monospace' }}>
                            {repo.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full" style={{ width: `${repo.score}%`, background: scoreColor }} />
                          </div>
                          <span className="text-[12px] font-semibold tabular-nums" style={{ color: scoreColor }}>{repo.score}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-[12px] font-medium tabular-nums" style={{ color: C.text }}>{repo.secrets}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-[12px]" style={{ color: C.textSecondary }}>{repo.age}</span>
                      </td>
                      <td className="py-3">
                        <span
                          className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold capitalize"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {repo.contributorRisk}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ─── ROW 5: Live Activity Feed ───────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Activity size={15} color={C.purple} />
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.green }} />
              </div>
              <h3 className="text-[15px] font-semibold" style={{ color: C.text }}>Live Activity</h3>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-md"
              style={{ color: C.green, background: 'rgba(34,197,94,0.08)' }}>
              Streaming
            </span>
          </div>
          <div className="space-y-0.5">
            {activityFeed.map((item, idx) => {
              const cfg = {
                critical: { color: C.red, icon: AlertTriangle, label: 'CRITICAL' },
                warning: { color: C.amber, icon: FileWarning, label: 'WARNING' },
                resolved: { color: C.green, icon: CheckCircle2, label: 'RESOLVED' },
                info: { color: C.blue, icon: CircleDot, label: 'INFO' },
              }
              const c = cfg[item.type]
              const Icon = c.icon
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.02]"
                  style={{ borderLeft: `2px solid ${c.color}` }}
                >
                  <Icon size={13} color={c.color} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ color: c.color, background: `${c.color}12` }}>
                        {c.label}
                      </span>
                      <span className="text-[11px]" style={{ color: C.textSecondary }}>
                        {item.message}{' '}
                        <span style={{ color: C.text, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{item.repo}</span>
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: C.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>{item.file}</p>
                  </div>
                  <span className="text-[10px] shrink-0 tabular-nums" style={{ color: C.textMuted }}>{item.time}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <footer className="flex items-center justify-between pt-2 pb-6">
          <div className="flex items-center gap-2">
            <Shield size={11} color={C.textMuted} />
            <span className="text-[10px]" style={{ color: C.textMuted }}>TheVaultSentry v2.4.0</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px]" style={{ color: C.textMuted }}>Last sync: 2 min ago</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
              <span className="text-[10px]" style={{ color: C.green }}>All systems operational</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
