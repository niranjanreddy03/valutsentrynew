'use client'

import Link from 'next/link'
import { Shield, Moon, Sun, ArrowLeft } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function PrivacyPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 text-zinc-400" />
        ) : (
          <Moon className="w-4 h-4 text-zinc-600" />
        )}
      </button>

      <div className="min-h-screen flex flex-col items-center p-4 py-8">
        <div className="w-full max-w-3xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-zinc-900 dark:bg-white mb-4">
              <Shield className="w-7 h-7 text-white dark:text-zinc-900" />
            </Link>
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white mb-1">
              Privacy Policy
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              Last updated: April 15, 2026
            </p>
          </div>

          {/* Content Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 sm:p-10 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <article className="space-y-6 text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <p>
                This Privacy Policy explains how VaultSentry (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, 
                stores, and protects your personal data when you use the Service. We take privacy seriously — 
                handling your source code and credentials responsibly is core to everything we build.
              </p>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">1. Information We Collect</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Account data:</strong> name, email address, hashed password, organization name, role, and subscription status.
                  </li>
                  <li>
                    <strong>Repository metadata:</strong> repository URLs, branch names, commit SHAs, scan configuration, and scan history.
                  </li>
                  <li>
                    <strong>Scan results:</strong> file paths, line numbers, detection rule IDs, masked and hashed
                    secret values, risk scores, and remediation status.
                  </li>
                  <li>
                    <strong>Usage &amp; analytics data:</strong> IP address, browser type, device information, pages visited, 
                    feature usage patterns, and request timing — used for security, rate-limiting, and product improvement.
                  </li>
                  <li>
                    <strong>Payment data:</strong> billing address and payment method details processed securely 
                    through our PCI-DSS compliant payment processor. Card data never touches our servers.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">2. How We Handle Your Code</h2>
                <p>
                  When you scan a repository, VaultSentry clones it to isolated, ephemeral storage, runs detection 
                  rules in a sandboxed environment, then immediately deletes the checkout. Only the following is retained:
                </p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>A <strong>SHA-256 hash</strong> of each detected secret (for deduplication and tracking).</li>
                  <li>A <strong>masked</strong> value (first and last 4 characters only, the rest starred).</li>
                  <li>File path, line number, and up to 3 lines of surrounding code for the finding snippet.</li>
                  <li>Detection metadata: rule ID, confidence score, risk level, and secret type classification.</li>
                </ul>
                <p className="mt-2">
                  The raw secret value is <strong>never persisted</strong> server-side. Code snippets may contain 
                  adjacent source code — keep this in mind when reviewing findings with your team.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">3. How We Use Your Data</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Service delivery:</strong> run scans, display results, send alerts, manage subscriptions, and enforce policies.</li>
                  <li><strong>Detection improvement:</strong> aggregate, anonymized metrics to refine our detection rules and reduce false positives.</li>
                  <li><strong>Security operations:</strong> detect abuse, enforce rate limits, investigate incidents, and maintain audit logs.</li>
                  <li><strong>Communication:</strong> transactional emails (verification codes, receipts, critical security alerts, team invitations). You may opt out of non-essential emails at any time from your profile settings.</li>
                  <li><strong>Compliance reporting:</strong> generate audit trails and compliance evidence for your organization&apos;s security controls.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">4. Legal Basis for Processing</h2>
                <p>We process your personal data under the following legal bases:</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li><strong>Contract performance:</strong> to provide the Service you signed up for.</li>
                  <li><strong>Legitimate interest:</strong> to improve our products, prevent fraud, and ensure security.</li>
                  <li><strong>Consent:</strong> for optional communications and analytics you&apos;ve opted into.</li>
                  <li><strong>Legal obligation:</strong> to comply with applicable laws and regulatory requirements.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">5. Sharing &amp; Third Parties</h2>
                <p>
                  We do <strong>not</strong> sell your personal data. We share limited data with sub-processors 
                  strictly to deliver and maintain the Service:
                </p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li><strong>Supabase</strong> — authentication, database, and real-time services.</li>
                  <li><strong>Cloud infrastructure providers</strong> — hosting scan workers, databases, and static assets.</li>
                  <li><strong>Payment processor</strong> — subscription billing and invoice management.</li>
                  <li><strong>Email delivery service</strong> — transactional notifications and alerts.</li>
                </ul>
                <p className="mt-2">
                  Each sub-processor is bound by a data-processing agreement with confidentiality and security terms 
                  at least as strict as this Policy. We maintain a current list of sub-processors available upon request.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">6. International Data Transfers</h2>
                <p>
                  Your data may be transferred to and processed in countries outside your own. Where personal data 
                  is transferred internationally, we ensure appropriate safeguards are in place, including Standard 
                  Contractual Clauses (SCCs) or equivalent mechanisms approved by relevant data protection authorities.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">7. Data Retention</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>Scan results are retained for the lifetime of your account or until you delete them.</li>
                  <li>Audit logs are retained for a minimum of 12 months to support compliance requirements.</li>
                  <li>Closed accounts are purged within 90 days, except where retention is required by law (e.g., billing records retained for 7 years).</li>
                  <li>Ephemeral scan data (cloned repositories) is deleted immediately upon scan completion.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">8. Your Rights</h2>
                <p>Depending on your jurisdiction (including GDPR, CCPA/CPRA), you may have the right to:</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li><strong>Access</strong> — request a copy of your personal data we hold.</li>
                  <li><strong>Rectification</strong> — correct inaccurate or incomplete personal data.</li>
                  <li><strong>Erasure</strong> — request deletion of your personal data (&quot;right to be forgotten&quot;).</li>
                  <li><strong>Portability</strong> — export your data in a structured, machine-readable format.</li>
                  <li><strong>Restriction</strong> — limit the processing of your data in certain circumstances.</li>
                  <li><strong>Objection</strong> — object to processing based on legitimate interests or for direct marketing.</li>
                  <li><strong>Withdraw consent</strong> — where processing is based on consent, you may withdraw it at any time.</li>
                  <li><strong>Non-discrimination</strong> — exercise your rights without receiving discriminatory treatment.</li>
                </ul>
                <p className="mt-2">
                  To exercise any of these rights, email{' '}
                  <a href="mailto:privacy@thevaultsentry.com" className="text-zinc-900 dark:text-white underline">
                    privacy@thevaultsentry.com
                  </a>. 
                  We will respond within 30 days (or as required by applicable law).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">9. Security Measures</h2>
                <p>We implement industry-standard security measures to protect your data:</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Encryption in transit (TLS 1.3) and at rest (AES-256).</li>
                  <li>Least-privilege access controls with role-based permissions.</li>
                  <li>Comprehensive audit logging of all data access and administrative actions.</li>
                  <li>Regular security assessments and penetration testing.</li>
                  <li>Isolated, sandboxed scan execution environments.</li>
                </ul>
                <p className="mt-2">
                  No system is perfectly secure. If we discover a breach affecting your data, we will notify you 
                  and the appropriate authorities as required by law, typically within 72 hours of discovery.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">10. Cookies &amp; Tracking</h2>
                <p>
                  We use <strong>essential cookies only</strong> for authentication and session management. No 
                  third-party advertising, tracking, or social media cookies are used. We do not participate in 
                  cross-site tracking or ad networks.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">11. Children&apos;s Privacy</h2>
                <p>
                  VaultSentry is a professional security platform not directed to individuals under 16. We do not 
                  knowingly collect data from children. If you believe a child has provided us data, please contact 
                  us immediately and we will delete it.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">12. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy as the Service evolves and regulations change. Material changes 
                  will be announced via email or in-product notice at least 30 days before taking effect. The 
                  &quot;Last updated&quot; date at the top reflects when this Policy was last revised.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">13. Contact Us</h2>
                <p>
                  Privacy questions, data requests, or concerns? Reach out to us:
                </p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>
                    Email:{' '}
                    <a href="mailto:privacy@thevaultsentry.com" className="text-zinc-900 dark:text-white underline">
                      privacy@thevaultsentry.com
                    </a>
                  </li>
                  <li>
                    Data Protection Officer:{' '}
                    <a href="mailto:dpo@thevaultsentry.com" className="text-zinc-900 dark:text-white underline">
                      dpo@thevaultsentry.com
                    </a>
                  </li>
                </ul>
              </section>
            </article>

            <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to registration
              </Link>
              <Link
                href="/terms"
                className="text-sm font-medium text-zinc-900 dark:text-white hover:underline"
              >
                Terms of Service →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
