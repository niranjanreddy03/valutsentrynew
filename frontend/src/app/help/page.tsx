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
    Github,
    HelpCircle,
    Key,
    Mail,
    MessageCircle,
    Scan,
    Search,
    Settings,
    Shield,
    Slack,
    Terminal,
    Zap
} from 'lucide-react'
import { useState } from 'react'

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
    question: 'What types of secrets can Vault Sentry detect?',
    answer: 'Vault Sentry can detect over 100+ types of secrets including AWS keys, API tokens, database credentials, SSH keys, OAuth tokens, JWT secrets, Stripe keys, GitHub tokens, and many more. Our ML-powered detection also identifies custom secrets based on entropy and context analysis.'
  },
  {
    question: 'How do I add a repository for scanning?',
    answer: 'Navigate to the Repositories page, click "Add Repository", enter your repository URL (GitHub, GitLab, Bitbucket, or Azure DevOps), select the branch to monitor, and click Add. You can also connect via OAuth for easier setup.'
  },
  {
    question: 'What happens when a secret is detected?',
    answer: 'When a secret is detected, Vault Sentry creates an alert based on severity (critical, high, medium, low), sends notifications via your configured channels (email, Slack), and adds the finding to your dashboard. You can then review, rotate, or mark as false positive.'
  },
  {
    question: 'How does automatic secret rotation work?',
    answer: 'For supported providers (AWS, Stripe, GitHub), Vault Sentry can automatically rotate compromised credentials. Configure your integration settings with appropriate permissions, and enable auto-rotation in your policies. The old secret is revoked and a new one is generated.'
  },
  {
    question: 'Can I scan S3 buckets for secrets?',
    answer: 'Yes! Go to Settings → Integrations → AWS, configure your AWS credentials with S3 read permissions, then use the Cloud Scanning feature to scan any S3 bucket for exposed secrets in files.'
  },
  {
    question: 'How do I integrate Vault Sentry into my CI/CD pipeline?',
    answer: 'Use our GitHub Action or CLI tool. Add the workflow file to your repository\'s .github/workflows/ directory or install the CLI with `pip install VaultSentry`. Scans run on every push/PR and block deployments if critical secrets are found.'
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
          <h4 className="font-semibold text-[var(--text-primary)]">Welcome to Vault Sentry!</h4>
          <p className="text-[var(--text-secondary)]">Follow these steps to secure your codebase:</p>
          <ol className="list-decimal list-inside space-y-3 text-[var(--text-secondary)]">
            <li><strong>Add a Repository:</strong> Go to Repositories → Add Repository → Enter your Git URL</li>
            <li><strong>Run Your First Scan:</strong> Click "Run Scan" on any repository to detect secrets</li>
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
            <p><strong>Setup:</strong> Configure AWS credentials in Settings → Integrations → AWS</p>
            <p><strong>Required Permissions:</strong> s3:ListBucket, s3:GetObject</p>
            <p><strong>Scanning:</strong> Select buckets from the Cloud Scanning page and run scans</p>
            <p><strong>File Types:</strong> Scans config files, scripts, .env files, and source code</p>
            <p><strong>Size Limits:</strong> Files up to 10MB are scanned (configurable)</p>
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
{`- name: Vault Sentry Scan
  uses: VaultSentry/action@v1
  with:
    api_key: \${{ secrets.VaultSentry_API_KEY }}
    fail_on: critical`}
            </pre>
            <p><strong>CLI Installation:</strong></p>
            <pre className="bg-[var(--bg-tertiary)] p-3 rounded-lg text-sm overflow-x-auto">
{`pip install VaultSentry
VaultSentry scan --path . --fail-on critical`}
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
              <a href="https://docs.VaultSentry.io" target="_blank" rel="noopener noreferrer" className="card p-4 hover:border-blue-500/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Book className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">Documentation</h3>
                    <p className="text-xs text-[var(--text-muted)]">Full API & SDK docs</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[var(--text-muted)] ml-auto" />
                </div>
              </a>
              
              <a href="https://github.com/VaultSentry/VaultSentry" target="_blank" rel="noopener noreferrer" className="card p-4 hover:border-blue-500/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
                    <Github className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">GitHub</h3>
                    <p className="text-xs text-[var(--text-muted)]">Source & issues</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[var(--text-muted)] ml-auto" />
                </div>
              </a>
              
              <a href="https://VaultSentry.slack.com" target="_blank" rel="noopener noreferrer" className="card p-4 hover:border-blue-500/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Slack className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">Community</h3>
                    <p className="text-xs text-[var(--text-muted)]">Join Slack</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[var(--text-muted)] ml-auto" />
                </div>
              </a>
              
              <a href="mailto:support@VaultSentry.io" className="card p-4 hover:border-blue-500/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">Contact</h3>
                    <p className="text-xs text-[var(--text-muted)]">Email support</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[var(--text-muted)] ml-auto" />
                </div>
              </a>
            </div>

            {/* Guides */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                User Guides
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {guides.map((guide) => (
                  <div key={guide.id}>
                    <button
                      onClick={() => setActiveGuide(activeGuide === guide.id ? null : guide.id)}
                      className={`w-full p-4 rounded-xl border transition-all text-left ${
                        activeGuide === guide.id
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--accent)]">
                          {guide.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-[var(--text-primary)]">{guide.title}</h3>
                          <p className="text-xs text-[var(--text-muted)]">{guide.description}</p>
                        </div>
                        {activeGuide === guide.id ? (
                          <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                        )}
                      </div>
                    </button>
                    {activeGuide === guide.id && (
                      <div className="mt-2 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                        {guide.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

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
              Vault Sentry v1.0.0 • Last updated: February 2026
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
