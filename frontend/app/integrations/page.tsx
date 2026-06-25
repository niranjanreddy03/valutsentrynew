'use client'

/**
 * Integrations hub — central configuration for every external system the
 * app talks to. Everything is stored via the existing policyExecutor
 * webhook config (localStorage) so Policies can reuse it immediately.
 */

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { getAuthHeaders } from '@/lib/authHeaders'
import { supabase } from '@/services/supabase'
import {
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
  // Step-up MFA — every saved secret across this page is masked by default
  // and requires a fresh authenticator code to reveal or replace.
  const [mfaInFlight, setMfaInFlight] = useState(false)
  const [mfaPrompt, setMfaPrompt] = useState<{
    purpose: string
    factorId: string
    challengeId: string
    resolve: (ok: boolean) => void
  } | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)
  const [mfaError, setMfaError] = useState<string | null>(null)

  // Step-up MFA: returns true if the user has an enrolled TOTP factor and
  // successfully verifies a code. Returns false on cancel or any failure.
  async function requireMfa(purpose: string): Promise<boolean> {
    setMfaInFlight(true)
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors()
      if (listErr) {
        showToast(listErr.message || 'Could not check MFA status', 'error')
        return false
      }
      const verified = factors?.totp?.find((f) => f.status === 'verified')
      if (!verified) {
        showToast('Enable two-factor auth in Settings → Security to reveal saved secrets', 'warning')
        return false
      }
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: verified.id })
      if (chErr || !ch?.id) {
        showToast(chErr?.message || 'Could not start MFA challenge', 'error')
        return false
      }
      return new Promise<boolean>((resolve) => {
        setMfaCode('')
        setMfaError(null)
        setMfaPrompt({
          purpose,
          factorId: verified.id,
          challengeId: ch.id,
          resolve,
        })
      })
    } finally {
      setMfaInFlight(false)
    }
  }

  const closeMfaPrompt = (ok: boolean) => {
    if (mfaPrompt) {
      mfaPrompt.resolve(ok)
      setMfaPrompt(null)
      setMfaCode('')
      setMfaError(null)
    }
  }

  const submitMfaCode = async () => {
    if (!mfaPrompt) return
    const code = mfaCode.trim()
    if (!code) {
      setMfaError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setMfaVerifying(true)
    setMfaError(null)
    try {
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: mfaPrompt.factorId,
        challengeId: mfaPrompt.challengeId,
        code,
      })
      if (vErr) {
        setMfaError(vErr.message || 'Invalid code. Try the latest code from your authenticator.')
        setMfaCode('')
        return
      }
      closeMfaPrompt(true)
    } finally {
      setMfaVerifying(false)
    }
  }

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
  const maskedToken = '****************'

  useEffect(() => {
    // Webhook config lives only on the backend (encrypted at rest). We do NOT
    // seed from localStorage — those values are credentials and an XSS would
    // exfiltrate them.
    const loadStatus = async () => {
      try {
        const configRes = await fetch('/api/v1/integrations/config', {
          headers: getAuthHeaders(),
        })
        if (configRes.ok) {
          const config = await configRes.json()
          setCfg(config)
        }

        const res = await fetch('/api/v1/integrations/github/token/status', {
          headers: getAuthHeaders(),
        })
        if (res.ok) {
          const data = await res.json()
          setGitTokens((prev) => ({
            ...prev,
            githubConnected: Boolean(data.configured),
            githubUsername: data.github_username,
            githubToken: data.configured ? maskedToken : '',
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
    if (!token || token === maskedToken) {
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
        [`${provider}Token`]: maskedToken,
        ...(provider === 'github' && data.github_username
          ? { githubUsername: data.github_username }
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

  const handleValidateToken = async (provider: 'github' | 'gitlab' = 'github') => {
    setValidatingToken(true)
    try {
      const res = await fetch(`/api/v1/integrations/${provider}/token/validate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.valid) {
        showToast(`Token valid · authenticated as @${data.username || 'user'}`, 'success')
        if (provider === 'github') {
          setGitTokens((prev) => ({ ...prev, githubUsername: data.username }))
        }
      } else {
        showToast(data.error_message || 'Token is invalid or expired', 'error')
      }
    } catch (e: any) {
      showToast(e?.message || 'Validation failed', 'error')
    } finally {
      setValidatingToken(false)
    }
  }

  const save = async (next: PolicyWebhookConfig) => {
    // Optimistic UI; revert on failure so a stale cleartext URL never lingers.
    const prev = cfg
    setCfg(next)
    try {
      const saved = await setPolicyWebhooks(next)
      setCfg(saved)
    } catch (err: any) {
      setCfg(prev)
      showToast(err?.message || 'Could not save integration', 'error')
    }
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
      const res = await fetch('/api/integrations/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || `Webhook responded ${data.status || res.status}`)
      }
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
    slack: true,
    jira: true,
    webhook: true,
    github: checkFeature('github_app_integration'),
    gitlab: checkFeature('github_app_integration'),
    apiKeys: checkFeature('api_access'),
    mlRisk: checkFeature('ml_risk_scoring'),
    s3: true,
    scheduled: checkFeature('scheduled_scans'),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header alertCount={0} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
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
              <MaskedSecretField
                label="Incoming webhook URL"
                value={cfg.slackWebhookUrl}
                placeholder="https://hooks.slack.com/services/..."
                requireMfa={requireMfa}
                mfaInFlight={mfaInFlight}
                onSave={(next) => {
                  save({ ...cfg, slackWebhookUrl: next })
                  showToast('Slack webhook saved', 'success')
                }}
                onRevoke={() => {
                  save({ ...cfg, slackWebhookUrl: '' })
                  showToast('Slack webhook removed', 'success')
                }}
                onTest={() => testWebhook(cfg.slackWebhookUrl, 'Slack')}
                testing={testing === 'Slack'}
                showToast={showToast}
                purposeLabel="Slack webhook"
              />
            </IntegrationCard>

            <IntegrationCard
              icon={<Ticket className="h-5 w-5 text-[#0052CC]" />}
              title="Jira"
              description="Open tickets automatically for every critical finding."
              connected={Boolean(cfg.jiraWebhookUrl)}
              locked={!can.jira}
              requiredTier="premium_plus"
            >
              <MaskedSecretField
                label="Automation webhook URL"
                value={cfg.jiraWebhookUrl}
                placeholder="https://yoursite.atlassian.net/..."
                requireMfa={requireMfa}
                mfaInFlight={mfaInFlight}
                onSave={(next) => {
                  save({ ...cfg, jiraWebhookUrl: next })
                  showToast('Jira webhook saved', 'success')
                }}
                onRevoke={() => {
                  save({ ...cfg, jiraWebhookUrl: '' })
                  showToast('Jira webhook removed', 'success')
                }}
                onTest={() => testWebhook(cfg.jiraWebhookUrl, 'Jira')}
                testing={testing === 'Jira'}
                showToast={showToast}
                purposeLabel="Jira webhook"
              />
              {/* Project key isn't a secret, so it stays plainly editable. */}
              <div className="mt-4">
                <label className="block text-xs font-medium text-[var(--text-muted)]">
                  Default project key
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={cfg.jiraProjectKey || ''}
                    onChange={(e) => setCfg({ ...cfg, jiraProjectKey: e.target.value })}
                    placeholder="SEC"
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      save(cfg)
                      showToast('Project key saved', 'success')
                    }}
                    className="btn btn-secondary"
                  >
                    <Save className="h-4 w-4" /> Save
                  </button>
                </div>
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
              <MaskedSecretField
                label="Webhook URL"
                value={cfg.genericWebhookUrl}
                placeholder="https://example.com/hook"
                requireMfa={requireMfa}
                mfaInFlight={mfaInFlight}
                onSave={(next) => {
                  save({ ...cfg, genericWebhookUrl: next })
                  showToast('Webhook saved', 'success')
                }}
                onRevoke={() => {
                  save({ ...cfg, genericWebhookUrl: '' })
                  showToast('Webhook removed', 'success')
                }}
                onTest={() => testWebhook(cfg.genericWebhookUrl, 'Webhook')}
                testing={testing === 'Webhook'}
                showToast={showToast}
                purposeLabel="webhook URL"
              />
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
              <MaskedTokenField
                label="Personal Access Token (PAT)"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                saved={gitTokens.githubConnected}
                draft={gitTokens.githubToken === maskedToken ? '' : gitTokens.githubToken}
                onDraftChange={(t) => setGitTokens({ ...gitTokens, githubToken: t })}
                saving={savingToken}
                onSave={() => handleSaveToken('github')}
                onRevoke={() => handleRevokeToken('github')}
                onValidate={handleValidateToken}
                validating={validatingToken}
                username={gitTokens.githubUsername}
                requireMfa={requireMfa}
                mfaInFlight={mfaInFlight}
                showToast={showToast}
                purposeLabel="GitHub token"
                helperText={
                  <>
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
                  </>
                }
              />

              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-xs text-amber-500 dark:text-amber-400">
                  <Shield className="mr-1 inline h-3 w-3" />
                  <strong>Security:</strong> Tokens are encrypted with AES-256
                  before storage. Never logged, displayed, or transmitted in
                  plaintext.
                </p>
              </div>
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
              <MaskedTokenField
                label="Personal Access Token"
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                saved={gitTokens.gitlabConnected}
                draft={gitTokens.gitlabToken === maskedToken ? '' : gitTokens.gitlabToken}
                onDraftChange={(t) => setGitTokens({ ...gitTokens, gitlabToken: t })}
                saving={savingToken}
                onSave={() => handleSaveToken('gitlab')}
                onRevoke={() => handleRevokeToken('gitlab')}
                onValidate={() => handleValidateToken('gitlab')}
                validating={validatingToken}
                requireMfa={requireMfa}
                mfaInFlight={mfaInFlight}
                showToast={showToast}
                purposeLabel="GitLab token"
                helperText={
                  <>
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
                  </>
                }
              />

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

      <Modal
        isOpen={Boolean(mfaPrompt)}
        onClose={() => closeMfaPrompt(false)}
        title="Two-factor verification"
        description={
          mfaPrompt
            ? `Enter your authenticator code to ${mfaPrompt.purpose}.`
            : undefined
        }
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Authenticator code
            </label>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={mfaCode}
              onChange={(e) => {
                setMfaCode(e.target.value.replace(/\D/g, ''))
                if (mfaError) setMfaError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitMfaCode()
                }
              }}
              placeholder="123456"
              className={`mt-1 w-full rounded-lg border bg-[var(--bg-tertiary)] px-3 py-2 text-center text-lg font-mono tracking-[0.4em] text-[var(--text-primary)] focus:outline-none ${
                mfaError
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-[var(--border-color)] focus:border-[var(--accent)]'
              }`}
            />
            {mfaError ? (
              <p className="mt-2 text-xs text-red-400">{mfaError}</p>
            ) : (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                <Shield className="mr-1 inline h-3 w-3" />
                Open your authenticator app (Google Authenticator, 1Password, Authy)
                and enter the current 6-digit code.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => closeMfaPrompt(false)}
              disabled={mfaVerifying}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitMfaCode}
              disabled={mfaVerifying || mfaCode.trim().length < 6}
              className="btn btn-primary"
            >
              {mfaVerifying ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Verify
            </button>
          </div>
        </div>
      </Modal>
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

/**
 * MaskedSecretField — once a value is saved, the field renders as a masked
 * placeholder. Reveal/Replace require a fresh MFA challenge from the parent's
 * requireMfa(). Revoke is a one-click clear (still confirmable by the parent).
 *
 * The component holds only its own UI state (editing / draft / revealed); the
 * parent owns persistence and is the source of truth for `value`.
 */
function MaskedSecretField({
  label,
  value,
  placeholder,
  requireMfa,
  mfaInFlight,
  onSave,
  onRevoke,
  onTest,
  testing,
  showToast,
  purposeLabel,
}: {
  label: string
  value: string | undefined
  placeholder: string
  requireMfa: (purpose: string) => Promise<boolean>
  mfaInFlight: boolean
  onSave: (next: string) => void
  onRevoke?: () => void
  onTest?: () => void
  testing?: boolean
  showToast: (msg: string, kind?: 'success' | 'error' | 'warning' | 'info') => void
  purposeLabel: string
}) {
  const [editing, setEditing] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [draft, setDraft] = useState('')

  const hasSaved = Boolean(value)
  const showEditor = !hasSaved || editing

  if (showEditor) {
    return (
      <>
        <label className="block text-xs font-medium text-[var(--text-muted)]">
          {label}
        </label>
        <input
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              const next = draft.trim()
              if (!next) {
                showToast('Enter a URL first', 'warning')
                return
              }
              onSave(next)
              setEditing(false)
              setDraft('')
              setRevealed(false)
            }}
            className="btn btn-primary"
          >
            <Save className="h-4 w-4" /> Save
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(false)
                setDraft('')
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <label className="block text-xs font-medium text-[var(--text-muted)]">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          type="text"
          readOnly
          value={revealed ? value || '' : '••••••••••••••••••••••••••••••'}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="button"
          onClick={async () => {
            if (revealed) {
              setRevealed(false)
              return
            }
            const ok = await requireMfa(`reveal the ${purposeLabel}`)
            if (ok) {
              setRevealed(true)
              showToast('Revealed', 'success')
            }
          }}
          disabled={mfaInFlight}
          className="btn btn-secondary"
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={async () => {
            const ok = await requireMfa(`replace the ${purposeLabel}`)
            if (!ok) return
            setDraft(value || '')
            setEditing(true)
            setRevealed(false)
          }}
          disabled={mfaInFlight}
          className="btn btn-secondary"
        >
          <RefreshCw className="h-4 w-4" /> Replace
        </button>
        {onTest && (
          <button
            onClick={onTest}
            disabled={Boolean(testing)}
            className="btn btn-secondary"
          >
            <Send className="h-4 w-4" />
            {testing ? 'Sending…' : 'Send test'}
          </button>
        )}
        {onRevoke && (
          <button
            onClick={async () => {
              if (!confirm(`Remove the saved ${purposeLabel}?`)) return
              const ok = await requireMfa(`revoke the ${purposeLabel}`)
              if (!ok) return
              onRevoke()
              setRevealed(false)
            }}
            disabled={mfaInFlight}
            className="btn btn-secondary hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" /> Revoke
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        <Shield className="mr-1 inline h-3 w-3" />
        Saved. Reveal, Replace and Revoke require your authenticator code.
      </p>
    </>
  )
}

/**
 * MaskedTokenField — write-only token input for providers (GitHub, GitLab)
 * where the cleartext token never comes back from the backend. When a token
 * is on file we show a masked, read-only "configured" indicator and gate
 * Replace/Verify/Revoke behind a fresh MFA challenge from the parent.
 */
function MaskedTokenField({
  label,
  placeholder,
  saved,
  draft,
  onDraftChange,
  saving,
  onSave,
  onRevoke,
  onValidate,
  validating,
  username,
  requireMfa,
  mfaInFlight,
  showToast,
  purposeLabel,
  helperText,
}: {
  label: string
  placeholder: string
  saved: boolean
  draft: string
  onDraftChange: (next: string) => void
  saving: boolean
  onSave: () => void
  onRevoke: () => void
  onValidate?: () => void
  validating?: boolean
  username?: string
  requireMfa: (purpose: string) => Promise<boolean>
  mfaInFlight: boolean
  showToast: (msg: string, kind?: 'success' | 'error' | 'warning' | 'info') => void
  purposeLabel: string
  helperText?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const showEditor = !saved || editing

  if (showEditor) {
    return (
      <>
        <label className="block text-xs font-medium text-[var(--text-muted)]">{label}</label>
        <div className="mt-1 flex gap-2">
          <input
            type="password"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            onClick={async () => {
              const next = draft.trim()
              if (!next) {
                showToast('Enter a token first', 'warning')
                return
              }
              const ok = await requireMfa(`save your ${purposeLabel}`)
              if (!ok) return
              onSave()
              setEditing(false)
            }}
            disabled={saving || mfaInFlight}
            className="btn btn-primary"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
        {helperText && <div className="mt-3 text-xs text-[var(--text-muted)]">{helperText}</div>}
      </>
    )
  }

  return (
    <>
      <label className="block text-xs font-medium text-[var(--text-muted)]">{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          type="text"
          readOnly
          value="•••••••••••••••••••••••• configured"
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={async () => {
            const ok = await requireMfa(`replace your ${purposeLabel}`)
            if (!ok) return
            onDraftChange('')
            setEditing(true)
          }}
          disabled={mfaInFlight}
          className="btn btn-secondary"
        >
          <RefreshCw className="h-4 w-4" /> Replace
        </button>
        {onValidate && (
          <button
            onClick={onValidate}
            disabled={Boolean(validating)}
            className="btn btn-secondary"
          >
            {validating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Verify
          </button>
        )}
        <button
          onClick={async () => {
            if (!confirm(`Remove the saved ${purposeLabel}?`)) return
            const ok = await requireMfa(`revoke your ${purposeLabel}`)
            if (!ok) return
            onRevoke()
          }}
          disabled={saving || mfaInFlight}
          className="btn btn-secondary hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" /> Revoke
        </button>
      </div>

      {username && (
        <p className="mt-3 text-xs text-emerald-400">
          <CheckCircle2 className="mr-1 inline h-3 w-3" />
          Connected as <strong>@{username}</strong>
        </p>
      )}

      <p className="mt-2 text-xs text-[var(--text-muted)]">
        <Shield className="mr-1 inline h-3 w-3" />
        Saved. Replace, Verify and Revoke require your authenticator code.
      </p>

      {helperText && <div className="mt-3 text-xs text-[var(--text-muted)]">{helperText}</div>}
    </>
  )
}
