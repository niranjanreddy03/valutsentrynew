'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Card } from '@/components/ui'
import {
    Bell,
    Book,
    ChevronDown,
    ChevronRight,
    Cloud,
    ExternalLink,
    FileText,
    FolderGit2,
    GitPullRequest,
    Github,
    HelpCircle,
    Key,
    Mail,
    MessageCircle,
    Plug,
    Scan,
    Search,
    Settings,
    Shield,
    Slack,
    Terminal,
    Zap
} from 'lucide-react'
import { useState } from 'react'
import { X } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

interface GuideSection {
  id: string
  title: string
  icon: React.ReactNode
  description: string
  content: React.ReactNode
}

const faqs: FAQItem[] = [
  {
    question: 'What types of secrets can TheVaultSentry detect?',
    answer: 'TheVaultSentry can detect over 100+ types of secrets including AWS keys, API tokens, database credentials, SSH keys, OAuth tokens, JWT secrets, Stripe keys, GitHub tokens, and many more. Our ML-powered detection also identifies custom secrets based on entropy and context analysis.'
  },
  {
    question: 'How do I add a repository for scanning?',
    answer: 'Navigate to the Repositories page, click "Add Repository", enter your repository URL (GitHub, GitLab, Bitbucket, or Azure DevOps), select the branch to monitor, and click Add. You can also connect via OAuth for easier setup.'
  },
  {
    question: 'What happens when a secret is detected?',
    answer: 'When a secret is detected, TheVaultSentry creates an alert based on severity (critical, high, medium, low), sends notifications via your configured channels (email, Slack), and adds the finding to your dashboard. You can then review, rotate, or mark as false positive.'
  },
  {
    question: 'How does automatic secret rotation work?',
    answer: 'For supported providers (AWS, Stripe, GitHub), TheVaultSentry can automatically rotate compromised credentials. Configure your integration settings with appropriate permissions, and enable auto-rotation in your policies. The old secret is revoked and a new one is generated.'
  },
  {
    question: 'Can I scan S3 buckets for secrets?',
    answer: 'Yes! Go to Settings → Integrations → AWS, configure your AWS credentials with S3 read permissions, then use the Cloud Scanning feature to scan any S3 bucket for exposed secrets in files.'
  },
  {
    question: 'How do I integrate TheVaultSentry into my CI/CD pipeline?',
    answer: 'Use our GitHub Action or CLI tool. Add the workflow file to your repository\'s .github/workflows/ directory or install the CLI with `pip install TheVaultSentry`. Scans run on every push/PR and block deployments if critical secrets are found.'
  },
  {
    question: 'What is the ML risk scoring system?',
    answer: 'Our machine learning model analyzes multiple factors including entropy, pattern matching, file context, variable names, and historical data to assign a risk score (0-100) to each finding. Higher scores indicate higher likelihood of being a real, active secret.'
  },
  {
    question: 'How do I reduce false positives?',
    answer: 'Mark false positives in the Secrets page to train our ML model. Create custom policies to ignore specific patterns or files. Use the entropy threshold settings to tune sensitivity. Our model learns from your feedback to improve accuracy over time.'
  },
  {
    question: 'Can I set up custom notification rules?',
    answer: 'Yes! In Settings → Notifications, configure email and Slack notifications per severity level. In Policies → Alerts, create custom rules based on repository, file patterns, or secret types.'
  },
  {
    question: 'How do I export scan reports?',
    answer: 'Go to Reports page, select the date range and repositories, then click Export. Reports are available in PDF, CSV, and JSON formats. You can also schedule automatic weekly/monthly reports via email.'
  },
]

export default function HelpPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)
  const [activeGuide, setActiveGuide] = useState<string | null>(null)

  const filteredFAQs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const guides: GuideSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <Zap className="w-5 h-5" />,
      description: 'Quick start guide for new users',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">Welcome to TheVaultSentry!</h4>
          <p className="text-[var(--text-secondary)]">Follow these steps to secure your codebase:</p>
          <ol className="list-decimal list-inside space-y-3 text-[var(--text-secondary)]">
            <li><strong>Add a Repository:</strong> Go to Repositories → Add Repository → Enter your Git URL</li>
            <li><strong>Run Your First Scan:</strong> Click &quot;Run Scan&quot; on any repository to detect secrets</li>
            <li><strong>Review Findings:</strong> Check the Dashboard for detected secrets and their severity</li>
            <li><strong>Take Action:</strong> Rotate exposed credentials and update your code</li>
            <li><strong>Set Up Notifications:</strong> Configure Slack/email alerts in Settings</li>
          </ol>
        </div>
      )
    },
    {
      id: 'repositories',
      title: 'Managing Repositories',
      icon: <FolderGit2 className="w-5 h-5" />,
      description: 'Add, configure, and manage code repositories',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">Repository Management</h4>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>Supported Providers:</strong> GitHub, GitLab, Bitbucket, Azure DevOps</p>
            <p><strong>Adding via URL:</strong> Paste the repository URL and select the default branch to monitor.</p>
            <p><strong>OAuth Connection:</strong> Connect your GitHub/GitLab account for automatic repository discovery and webhook setup.</p>
            <p><strong>Webhooks:</strong> When configured, scans run automatically on every push.</p>
            <p><strong>Branch Monitoring:</strong> Configure which branches to scan (main, develop, feature/*).</p>
          </div>
        </div>
      )
    },
    {
      id: 'secrets',
      title: 'Understanding Secrets',
      icon: <Key className="w-5 h-5" />,
      description: 'Types of secrets and how to handle them',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">Secret Types & Severity</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-[var(--text-secondary)]"><strong>Critical:</strong> Active credentials with full access (AWS root keys, production DB passwords)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              <span className="text-[var(--text-secondary)]"><strong>High:</strong> API keys with significant permissions (Stripe live keys, GitHub PATs)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-[var(--text-secondary)]"><strong>Medium:</strong> Limited scope credentials (read-only tokens, internal API keys)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-[var(--text-secondary)]"><strong>Low:</strong> Potentially sensitive values (webhook URLs, non-production secrets)</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'scanning',
      title: 'Scanning & Detection',
      icon: <Scan className="w-5 h-5" />,
      description: 'How secret scanning works',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">Detection Methods</h4>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>Pattern Matching:</strong> 100+ regex patterns for known secret formats</p>
            <p><strong>Entropy Analysis:</strong> Shannon entropy to detect high-randomness strings</p>
            <p><strong>ML Classification:</strong> Machine learning model trained on millions of samples</p>
            <p><strong>Context Analysis:</strong> Variable names, file types, and surrounding code</p>
            <p><strong>Historical Learning:</strong> Learns from your feedback to reduce false positives</p>
          </div>
        </div>
      )
    },
    {
      id: 's3-scanning',
      title: 'S3 Bucket Scanning',
      icon: <Cloud className="w-5 h-5" />,
      description: 'Scan AWS S3 buckets for secrets',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">AWS S3 Integration</h4>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>Setup:</strong> Navigate to S3 Buckets from the sidebar, then click &quot;Add Bucket&quot; to connect your AWS account.</p>
            <p><strong>Required IAM Permissions:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">s3:ListBucket</code> — to enumerate objects in the bucket</li>
              <li><code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">s3:GetObject</code> — to read file contents for scanning</li>
              <li><code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">s3:ListAllMyBuckets</code> — (optional) to auto-discover all buckets</li>
            </ul>
            <p><strong>How It Works:</strong> TheVaultSentry downloads each object from the bucket, runs it through the same detection engine used for repository scans (pattern matching + entropy analysis), and reports any secrets found with their exact file path and line number.</p>
            <p><strong>Supported File Types:</strong> Config files (.env, .yml, .json, .toml, .ini), scripts (.sh, .py, .js, .ts), source code, Terraform/CloudFormation templates, and Docker files. Binary files and objects over 10 MB are skipped.</p>
            <p><strong>Scheduling:</strong> Enable periodic scans on the Scheduled Scans page to continuously monitor buckets for newly added secrets.</p>
          </div>
        </div>
      )
    },
    {
      id: 'closed-loop',
      title: 'Closed Loop Lifecycle',
      icon: <GitPullRequest className="w-5 h-5" />,
      description: 'End-to-end detection, validation, and remediation',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">How the Closed Loop Works</h4>
          <p className="text-[var(--text-secondary)]">The closed loop automates the full lifecycle of a leaked secret — from detection to remediation — so nothing falls through the cracks.</p>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>1. Detection:</strong> When a commit is pushed or a webhook event arrives, TheVaultSentry scans the changed files for secrets using pattern matching and entropy analysis.</p>
            <p><strong>2. Classification:</strong> Each finding is classified by provider (AWS, GitHub, Stripe, etc.) and assigned a severity and confidence score.</p>
            <p><strong>3. Deduplication:</strong> Secrets are fingerprinted using tenant-scoped HMAC so the same leaked credential only creates one incident, even if it appears in multiple files or commits.</p>
            <p><strong>4. Validation:</strong> TheVaultSentry safely checks whether the secret is still active by making read-only API calls to the provider (e.g., GitHub <code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">GET /user</code>, Stripe <code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">GET /v1/account</code>). No mutations are performed during validation.</p>
            <p><strong>5. Decision:</strong> Based on your org policy (auto-revoke settings, dry-run mode, approval requirements), the engine decides which remediation actions to take.</p>
            <p><strong>6. Remediation:</strong> Actions may include revoking/rotating the credential, opening a pull request to remove it from code, and sending notifications. In dry-run mode, steps are planned but not executed.</p>
            <p><strong>7. Audit Trail:</strong> Every step is logged with hash-linked, tamper-evident audit events for SOC 2 compliance.</p>
          </div>
          <h4 className="font-semibold text-[var(--text-primary)] mt-4">Policy Controls</h4>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>Dry-Run Mode:</strong> Enabled by default. Plans all remediation steps without actually revoking keys or opening PRs. Disable once you trust the pipeline.</p>
            <p><strong>Approval Gates:</strong> Require manual approval before remediating secrets in production/protected repositories or when confidence is below your threshold.</p>
            <p><strong>Auto-Revoke:</strong> Per-provider toggle to automatically revoke or rotate credentials when a high-confidence active leak is confirmed.</p>
          </div>
        </div>
      )
    },
    {
      id: 'integrations',
      title: 'Integrations',
      icon: <Plug className="w-5 h-5" />,
      description: 'Connect webhooks, SCM providers, and notification channels',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">Adding Integrations</h4>
          <p className="text-[var(--text-secondary)]">Navigate to the Integrations page from the sidebar to connect external services.</p>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>GitHub Webhooks:</strong> Connect your GitHub repositories to trigger automatic scans on every push. Go to Integrations → GitHub → Add Webhook, then paste the provided webhook URL into your GitHub repo settings (Settings → Webhooks). Select the <code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">push</code> event to scan new commits automatically.</p>
            <p><strong>GitLab Integration:</strong> Similar to GitHub — add the webhook URL under your GitLab project&apos;s Settings → Webhooks. Enable the Push events trigger.</p>
            <p><strong>Slack Notifications:</strong> Connect a Slack workspace to receive real-time alerts when secrets are detected. Go to Integrations → Slack → Connect, authorize the app, and select the channel for alerts. You can filter notifications by severity level.</p>
            <p><strong>Email Alerts:</strong> Configure email recipients under Integrations → Email. Set per-severity thresholds so critical findings notify immediately while low-severity findings are batched into daily digests.</p>
            <p><strong>Jira Ticketing:</strong> Automatically create Jira issues for detected secrets. Provide your Jira instance URL, project key, and API token. Each finding creates a ticket with severity, file location, and remediation steps.</p>
            <p><strong>Custom Webhooks:</strong> Send scan results to any HTTP endpoint. Configure the URL, authentication headers, and which events to forward (detection, remediation, policy violations). Payloads are signed with HMAC-SHA256 for verification.</p>
          </div>
          <h4 className="font-semibold text-[var(--text-primary)] mt-4">AWS Integration</h4>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>IAM Setup:</strong> Create an IAM role or user with read-only S3 permissions, then add the credentials in Integrations → AWS. TheVaultSentry uses these to scan S3 buckets and optionally revoke compromised AWS access keys.</p>
            <p><strong>CloudTrail:</strong> (Enterprise) Ingest CloudTrail logs to detect secrets used in API calls across your AWS environment.</p>
          </div>
        </div>
      )
    },
    {
      id: 'cicd',
      title: 'CI/CD Integration',
      icon: <Terminal className="w-5 h-5" />,
      description: 'Integrate into your deployment pipeline',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">Pipeline Integration</h4>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>GitHub Actions:</strong></p>
            <pre className="bg-[var(--bg-tertiary)] p-3 rounded-lg text-sm overflow-x-auto">
{`- name: TheVaultSentry Scan
  uses: TheVaultSentry/action@v1
  with:
    api_key: \${{ secrets.TheVaultSentry_API_KEY }}
    fail_on: critical`}
            </pre>
            <p><strong>CLI Installation:</strong></p>
            <pre className="bg-[var(--bg-tertiary)] p-3 rounded-lg text-sm overflow-x-auto">
{`pip install TheVaultSentry
TheVaultSentry scan --path . --fail-on critical`}
            </pre>
          </div>
        </div>
      )
    },
    {
      id: 'policies',
      title: 'Security Policies',
      icon: <Shield className="w-5 h-5" />,
      description: 'Configure detection rules and exceptions',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">Policy Configuration</h4>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>Ignore Patterns:</strong> Exclude test files, mock data, or documentation</p>
            <p><strong>Custom Rules:</strong> Define patterns for internal secret formats</p>
            <p><strong>Severity Overrides:</strong> Adjust severity for specific secret types</p>
            <p><strong>Auto-Rotation:</strong> Enable automatic credential rotation for supported providers</p>
            <p><strong>SLA Settings:</strong> Set remediation timeframes by severity level</p>
          </div>
        </div>
      )
    },
    {
      id: 'notifications',
      title: 'Alerts & Notifications',
      icon: <Bell className="w-5 h-5" />,
      description: 'Configure how you receive alerts',
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--text-primary)]">Notification Channels</h4>
          <div className="space-y-3 text-[var(--text-secondary)]">
            <p><strong>Email:</strong> Per-user email notifications with customizable frequency</p>
            <p><strong>Slack:</strong> Real-time alerts to channels with severity filtering</p>
            <p><strong>Webhooks:</strong> Custom HTTP endpoints for integration with other tools</p>
            <p><strong>Jira:</strong> Automatic ticket creation for critical findings</p>
            <p><strong>PagerDuty:</strong> Incident alerting for critical secrets (Enterprise)</p>
          </div>
        </div>
      )
    },
  ]

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} alertCount={0} />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                  <HelpCircle className="w-7 h-7 text-blue-400" />
                  Help Center
                </h1>
                <p className="text-[var(--text-muted)] mt-1">Documentation, guides, and support resources</p>
              </div>
            </div>

            {/* Search */}
            <Card className="p-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search help articles, FAQs, and guides..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </Card>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { icon: <Book className="w-5 h-5 text-blue-400" />, bg: 'bg-blue-500/20', title: 'Documentation', desc: 'Full API & SDK docs', href: 'https://docs.thevaultsentry.com' },
                { icon: <Github className="w-5 h-5 text-gray-400" />, bg: 'bg-gray-500/20', title: 'GitHub', desc: 'Source & issues', href: 'https://github.com/thevaultsentry' },
                { icon: <Slack className="w-5 h-5 text-purple-400" />, bg: 'bg-purple-500/20', title: 'Community', desc: 'Join Slack', href: 'https://community.thevaultsentry.com' },
                { icon: <Mail className="w-5 h-5 text-green-400" />, bg: 'bg-green-500/20', title: 'Contact', desc: 'Email support', href: 'mailto:support@thevaultsentry.com' },
              ].map((link) => (
                <a
                  key={link.title}
                  href={link.href}
                  target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                  className="card p-4 hover:border-blue-500/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${link.bg} flex items-center justify-center`}>
                      {link.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">{link.title}</h3>
                      <p className="text-xs text-[var(--text-muted)]">{link.desc}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[var(--text-muted)] ml-auto" />
                  </div>
                </a>
              ))}
            </div>

            {/* Guides — card grid */}
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-400" />
                User Guides
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {guides.map((guide) => (
                  <button
                    key={guide.id}
                    onClick={() => setActiveGuide(guide.id)}
                    className="card p-5 text-left hover:border-blue-500/50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-3 group-hover:bg-blue-500/20 transition-colors">
                      {guide.icon}
                    </div>
                    <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">{guide.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{guide.description}</p>
                    <span className="inline-flex items-center gap-1 text-xs text-blue-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      Read guide <ChevronRight className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Guide Modal */}
            {activeGuide && (() => {
              const guide = guides.find(g => g.id === activeGuide)
              if (!guide) return null
              return (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  onClick={() => setActiveGuide(null)}
                >
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <div
                    className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl border border-[var(--border-color)] overflow-hidden flex flex-col"
                    style={{ background: 'var(--bg-primary)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3 p-6 pb-4 border-b border-[var(--border-color)]">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                        {guide.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{guide.title}</h3>
                        <p className="text-xs text-[var(--text-muted)]">{guide.description}</p>
                      </div>
                      <button
                        onClick={() => setActiveGuide(null)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                      {guide.content}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* FAQs */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-400" />
                Frequently Asked Questions
              </h2>
              <div className="space-y-3">
                {filteredFAQs.map((faq, index) => (
                  <div
                    key={index}
                    className="border border-[var(--border-color)] rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                      className="w-full p-4 text-left flex items-center justify-between hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <span className="font-medium text-[var(--text-primary)] pr-4">{faq.question}</span>
                      {expandedFAQ === index ? (
                        <ChevronDown className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                      )}
                    </button>
                    {expandedFAQ === index && (
                      <div className="px-4 pb-4 text-[var(--text-secondary)]">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
                {filteredFAQs.length === 0 && (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    No FAQs match your search. Try different keywords.
                  </div>
                )}
              </div>
            </Card>

            {/* Keyboard Shortcuts */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Keyboard Shortcuts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">Go to Dashboard</span>
                  <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)] font-mono">G then D</kbd>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">Go to Repositories</span>
                  <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)] font-mono">G then R</kbd>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">Go to Secrets</span>
                  <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)] font-mono">G then S</kbd>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">New Scan</span>
                  <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)] font-mono">Ctrl + N</kbd>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">Search</span>
                  <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)] font-mono">Ctrl + K</kbd>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">Help</span>
                  <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)] font-mono">?</kbd>
                </div>
              </div>
            </Card>

            {/* Version Info */}
            <div className="text-center text-sm text-[var(--text-muted)] py-4">
              TheVaultSentry v1.0.0 • Last updated: February 2026
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
