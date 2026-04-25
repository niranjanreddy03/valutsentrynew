'use client'

/**
 * Integrations hub — central configuration for every external system the
 * app talks to. Everything is stored via the existing policyExecutor
 * webhook config (localStorage) so Policies can reuse it immediately.
 */

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { getAuthHeaders } from '@/lib/authHeaders'
import {
  getPolicyWebhooks,
  setPolicyWebhooks,
  PolicyWebhookConfig,
} from '@/lib/policyExecutor'
import {
  Activity,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Github,
  Globe,
  KeyRound,
  MessageSquare,
  Plug,
  RefreshCw,
  Save,
  Send,
  Shield,
  Ticket,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function IntegrationsPage() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const tier = (user?.subscription_tier || 'basic') as string
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [cfg, setCfg] = useState<PolicyWebhookConfig>({})
  const [testing, setTesting] = useState<string | null>(null)

  // Git provider token state — stored encrypted (AES-256) by the backend.
  // We never pull the real token value back; a masked placeholder tells the
  // UI a token is on file.
  const [gitTokens, setGitTokens] = useState({
    githubConnected: false,
    githubUsername: '' as string | undefined,
    githubToken: '',
    showGithubToken: false,
    gitlabConnected: false,
    gitlabToken: '',
    showGitlabToken: false,
  })
  const [savingToken, setSavingToken] = useState(false)
  const [validatingToken, setValidatingToken] = useState(false)

  useEffect(() => {
    setCfg(getPolicyWebhooks())
    // Fetch current GitHub token status (backend is the source of truth).
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/v1/integrations/github/token/status', {
          headers: getAuthHeaders(),
        })
        if (res.ok) {
          const data = await res.json()
          setGitTokens((prev) => ({
            ...prev,
            githubConnected: Boolean(data.connected),
            githubUsername: data.username,
            githubToken: data.connected ? '••••••••••••••••' : '',
          }))
        }
      } catch {
        // Backend offline — leave defaults; user can still set tokens.
      }
    }
    loadStatus()
  }, [])

  const handleSaveToken = async (provider: 'github' | 'gitlab') => {
    const token =
      provider === 'github' ? gitTokens.githubToken : gitTokens.gitlabToken
    if (!token || token === '••••••••••••••••') {
      showToast('Enter a token first', 'warning')
      return
    }
    setSavingToken(true)
    try {
      const res = await fetch(`/api/v1/integrations/${provider}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      const data = await res.json().catch(() => ({}))
      setGitTokens((prev) => ({
        ...prev,
        [`${provider}Connected`]: true,
        [`${provider}Token`]: '••••••••••••••••',
        ...(provider === 'github' && data.username
          ? { githubUsername: data.username }
          : {}),
      }))
      showToast(`${provider === 'github' ? 'GitHub' : 'GitLab'} token saved`, 'success')
    } catch (e: any) {
      showToast(e?.message || 'Failed to save token', 'error')
    } finally {
      setSavingToken(false)
    }
  }

  const handleRevokeToken = async (provider: 'github' | 'gitlab') => {
    setSavingToken(true)
    try {
      const res = await fetch(`/api/v1/integrations/${provider}/token`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error(`Revoke failed (${res.status})`)
      setGitTokens((prev) => ({
        ...prev,
        [`${provider}Connected`]: false,
        [`${provider}Token`]: '',
        ...(provider === 'github' ? { githubUsername: undefined } : {}),
      }))
      showToast(`${provider === 'github' ? 'GitHub' : 'GitLab'} token revoked`, 'success')
    } catch (e: any) {
      showToast(e?.message || 'Failed to revoke', 'error')
    } finally {
      setSavingToken(false)
    }
  }

  const handleValidateToken = async () => {
    setValidatingToken(true)
    try {
      const res = await fetch('/api/v1/integrations/github/token/validate', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.valid) {
        showToast(`Token valid · authenticated as @${data.username || 'user'}`, 'success')
        setGitTokens((prev) => ({ ...prev, githubUsername: data.username }))
      } else {
        showToast(data.error || 'Token is invalid or expired', 'error')
      }
    } catch (e: any) {
      showToast(e?.message || 'Validation failed', 'error')
    } finally {
      setValidatingToken(false)
    }
  }

  const save = (next: PolicyWebhookConfig) => {
    setPolicyWebhooks(next)
    setCfg(next)
  }

  const testWebhook = async (url: string | undefined, label: string) => {
    if (!url) {
      showToast(`Add a ${label} URL first`, 'warning')
      return
    }
    setTesting(label)
    try {
      const payload =
        label === 'Slack'
          ? { text: `:white_check_mark: VaultSentry test message from Integrations.` }
          : {
              source: 'vaultsentry',
              type: 'test',
              message: 'VaultSentry test webhook',
              at: new Date().toISOString(),
            }
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      showToast(`Test payload sent to ${label}`, 'success')
    } catch (e: any) {
      showToast(`Failed to reach ${label}: ${e?.message || 'unknown error'}`, 'error')
    } finally {
      setTesting(null)
    }
  }

  const isPaid = tier === 'premium' || tier === 'premium_plus'
  // Per-integration feature gating. Each integration is tied to a flag in
  // SubscriptionContext TIER_LIMITS — basic users see a locked card with an
  // upgrade CTA instead of the configuration form.
  const { checkFeature } = useSubscription()
  const can = {
    slack: checkFeature('slack_integration'),
    jira: checkFeature('jira_integration'),
    webhook: checkFeature('webhook_notifications'),
    github: checkFeature('github_app_integration'),
    gitlab: checkFeature('github_app_integration'),
    apiKeys: checkFeature('api_access'),
    mlRisk: checkFeature('ml_risk_scoring'),
    s3: checkFeature('aws_integration'),
    scheduled: checkFeature('scheduled_scans'),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
                <Plug className="h-6 w-6 text-[var(--accent)]" />
                Integrations
              </h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Connect Slack, Jira, GitHub and webhooks so policies can act the
                moment a secret is detected.
              </p>
            </div>
            <Link
              href="/policies"
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Manage policies →
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IntegrationCard
              icon={<MessageSquare className="h-5 w-5 text-[#4A154B]" />}
              title="Slack"
              description="Send formatted alert messages to a channel via an incoming webhook."
              connected={Boolean(cfg.slackWebhookUrl)}
              locked={!can.slack}
              requiredTier="premium"
            >
              <label className="block text-xs font-medium text-[var(--text-muted)]">
                Incoming webhook URL
              </label>
              <input
                type="url"
                value={cfg.slackWebhookUrl || ''}
                onChange={(e) => setCfg({ ...cfg, slackWebhookUrl: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    save(cfg)
                    showToast('Slack webhook saved', 'success')
                  }}
                  className="btn btn-primary"
                >
                  <Save className="h-4 w-4" /> Save
                </button>
                <button
                  onClick={() => testWebhook(cfg.slackWebhookUrl, 'Slack')}
                  disabled={testing === 'Slack'}
                  className="btn btn-secondary"
                >
                  <Send className="h-4 w-4" />
                  {testing === 'Slack' ? 'Sending…' : 'Send test'}
                </button>
              </div>
            </IntegrationCard>

            <IntegrationCard
              icon={<Ticket className="h-5 w-5 text-[#0052CC]" />}
              title="Jira"
              description="Open tickets automatically for every critical finding."
              connected={Boolean(cfg.jiraWebhookUrl)}
              locked={!can.jira}
              requiredTier="premium_plus"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Automation webhook URL
                  </label>
                  <input
                    type="url"
                    value={cfg.jiraWebhookUrl || ''}
                    onChange={(e) => setCfg({ ...cfg, jiraWebhookUrl: e.target.value })}
                    placeholder="https://yoursite.atlassian.net/..."
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Default project key
                  </label>
                  <input
                    type="text"
                    value={cfg.jiraProjectKey || ''}
                    onChange={(e) => setCfg({ ...cfg, jiraProjectKey: e.target.value })}
                    placeholder="SEC"
                    className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    save(cfg)
                    showToast('Jira settings saved', 'success')
                  }}
                  className="btn btn-primary"
                >
                  <Save className="h-4 w-4" /> Save
                </button>
                <button
                  onClick={() => testWebhook(cfg.jiraWebhookUrl, 'Jira')}
                  disabled={testing === 'Jira'}
                  className="btn btn-secondary"
                >
                  <Send className="h-4 w-4" />
                  {testing === 'Jira' ? 'Sending…' : 'Send test'}
                </button>
              </div>
            </IntegrationCard>

            <IntegrationCard
              icon={<Webhook className="h-5 w-5 text-emerald-400" />}
              title="Generic Webhook"
              description="POST a JSON payload for any action — use for SIEM, PagerDuty, or your own automation."
              connected={Boolean(cfg.genericWebhookUrl)}
              locked={!can.webhook}
              requiredTier="premium"
            >
              <label className="block text-xs font-medium text-[var(--text-muted)]">
                Webhook URL
              </label>
              <input
                type="url"
                value={cfg.genericWebhookUrl || ''}
                onChange={(e) => setCfg({ ...cfg, genericWebhookUrl: e.target.value })}
                placeholder="https://example.com/hook"
                className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    save(cfg)
                    showToast('Webhook saved', 'success')
                  }}
                  className="btn btn-primary"
                >
                  <Save className="h-4 w-4" /> Save
                </button>
                <button
                  onClick={() => testWebhook(cfg.genericWebhookUrl, 'Webhook')}
                  disabled={testing === 'Webhook'}
                  className="btn btn-secondary"
                >
                  <Send className="h-4 w-4" />
                  {testing === 'Webhook' ? 'Sending…' : 'Send test'}
                </button>
              </div>
            </IntegrationCard>

            <IntegrationCard
              icon={<Github className="h-5 w-5 text-[var(--text-primary)]" />}
              title="GitHub"
              description={
                gitTokens.githubConnected
                  ? 'Token configured — can scan private repositories.'
                  : 'Add a Personal Access Token to scan private repositories.'
              }
              connected={gitTokens.githubConnected}
              locked={!can.github}
              requiredTier="premium"
            >
              <label className="block text-xs font-medium text-[var(--text-muted)]">
                Personal Access Token (PAT)
              </label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={gitTokens.showGithubToken ? 'text' : 'password'}
                    value={gitTokens.githubToken}
                    onChange={(e) =>
                      setGitTokens({ ...gitTokens, githubToken: e.target.value })
                    }
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 pr-10 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setGitTokens({
                        ...gitTokens,
                        showGithubToken: !gitTokens.showGithubToken,
                      })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {gitTokens.showGithubToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => handleSaveToken('github')}
                  disabled={
                    savingToken || gitTokens.githubToken === '••••••••••••••••'
                  }
                  className="btn btn-primary"
                >
                  {savingToken ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </button>
              </div>

              {gitTokens.githubConnected && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleValidateToken}
                    disabled={validatingToken}
                    className="btn btn-secondary flex-1"
                  >
                    {validatingToken ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Verify Token
                  </button>
                  <button
                    onClick={() => handleRevokeToken('github')}
                    disabled={savingToken}
                    className="btn btn-secondary flex-1 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    Revoke Token
                  </button>
                </div>
              )}

              {gitTokens.githubUsername && (
                <p className="mt-3 text-xs text-emerald-400">
                  <CheckCircle2 className="mr-1 inline h-3 w-3" />
                  Connected as <strong>@{gitTokens.githubUsername}</strong>
                </p>
              )}

              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-xs text-amber-500 dark:text-amber-400">
                  <Shield className="mr-1 inline h-3 w-3" />
                  <strong>Security:</strong> Tokens are encrypted with AES-256
                  before storage. Never logged, displayed, or transmitted in
                  plaintext.
                </p>
              </div>

              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Create a token at{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=VaultSentry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  GitHub Settings → Developer settings → Personal access tokens
                </a>{' '}
                with <code className="rounded bg-[var(--bg-tertiary)] px-1">repo</code> scope only.
              </p>
            </IntegrationCard>

            <IntegrationCard
              icon={<Globe className="h-5 w-5 text-orange-400" />}
              title="GitLab"
              description={
                gitTokens.gitlabConnected
                  ? 'Token configured — can scan private repositories.'
                  : 'Add a Personal Access Token to scan private repositories.'
              }
              connected={gitTokens.gitlabConnected}
              locked={!can.gitlab}
              requiredTier="premium"
            >
              <label className="block text-xs font-medium text-[var(--text-muted)]">
                Personal Access Token
              </label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={gitTokens.showGitlabToken ? 'text' : 'password'}
                    value={gitTokens.gitlabToken}
                    onChange={(e) =>
                      setGitTokens({ ...gitTokens, gitlabToken: e.target.value })
                    }
                    placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 pr-10 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setGitTokens({
                        ...gitTokens,
                        showGitlabToken: !gitTokens.showGitlabToken,
                      })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {gitTokens.showGitlabToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => handleSaveToken('gitlab')}
                  disabled={savingToken}
                  className="btn btn-primary"
                >
                  {savingToken ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </button>
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Create a token at{' '}
                <a
                  href="https://gitlab.com/-/profile/personal_access_tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  GitLab → Preferences → Access Tokens
                </a>{' '}
                with{' '}
                <code className="rounded bg-[var(--bg-tertiary)] px-1">read_repository</code>{' '}
                scope.
              </p>

              <div className="mt-3 flex gap-2">
                <Link href="/repositories" className="btn btn-secondary">
                  <Github className="h-4 w-4" /> Manage repositories
                </Link>
                <Link href="/api-keys" className="btn btn-secondary">
                  <KeyRound className="h-4 w-4" /> Generate API key
                </Link>
              </div>
            </IntegrationCard>

            <IntegrationCard
              icon={<Activity className="h-5 w-5 text-purple-400" />}
              title="ML Risk Scoring"
              description="Use ML-based prioritisation to sort findings by likely impact rather than severity alone."
              connected={cfg.mlRiskScoringEnabled ?? true}
              locked={!can.mlRisk}
              requiredTier="premium"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={cfg.mlRiskScoringEnabled ?? true}
                  onChange={(e) => {
                    const next = { ...cfg, mlRiskScoringEnabled: e.target.checked }
                    save(next)
                    showToast(
                      e.target.checked
                        ? 'ML risk scoring enabled'
                        : 'ML risk scoring disabled',
                      'success',
                    )
                  }}
                  className="h-4 w-4 rounded"
                />
                Enable ML risk scoring on the dashboard
              </label>
            </IntegrationCard>

            <IntegrationCard
              icon={<Cloud className="h-5 w-5 text-orange-400" />}
              title="AWS S3 Buckets"
              description="Scan every object in an S3 bucket for leaked credentials. Supports path prefixes and IAM access keys."
              connected
              locked={!can.s3}
              requiredTier="premium_plus"
            >
              <Link href="/s3-buckets" className="btn btn-primary">
                Manage buckets →
              </Link>
            </IntegrationCard>

            <IntegrationCard
              icon={<Zap className="h-5 w-5 text-amber-400" />}
              title="Scheduled Scans"
              description="Run recurring scans against any repository without clicking a button."
              connected
              locked={!can.scheduled}
              requiredTier="premium"
            >
              <Link href="/scheduled-scans" className="btn btn-primary">
                Configure schedules →
              </Link>
            </IntegrationCard>
          </div>
        </div>
        </main>
      </div>
    </div>
  )
}

function IntegrationCard({
  icon,
  title,
  description,
  connected,
  locked,
  requiredTier = 'premium',
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  connected?: boolean
  locked?: boolean
  requiredTier?: 'premium' | 'premium_plus'
  children: React.ReactNode
}) {
  const tierLabel = requiredTier === 'premium_plus' ? 'Premium Plus' : 'Premium'
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--bg-secondary)]">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {title}
              </h3>
              {connected && !locked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              )}
              {locked && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: 'rgba(168,85,247,0.15)',
                    color: '#a78bfa',
                    border: '1px solid rgba(168,85,247,0.35)',
                  }}
                >
                  🔒 {tierLabel}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
          </div>
        </div>
      </div>

      {locked ? (
        // Replace the configuration UI entirely — no amount of opacity is
        // enough if the inputs remain editable and the Save handler fires.
        <div
          className="rounded-lg px-4 py-4 text-sm"
          style={{
            background:
              'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(139,92,246,0.06))',
            border: '1px dashed rgba(168,85,247,0.45)',
          }}
        >
          <p style={{ color: 'var(--text-secondary)' }}>
            This integration is available on the <strong>{tierLabel}</strong> plan.
            Upgrade to connect {title} and automate your workflow.
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Upgrade to {tierLabel} →
          </Link>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
