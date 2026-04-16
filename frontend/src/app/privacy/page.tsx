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
                This Privacy Policy explains how VaultSentry collects, uses, and protects your data when you use the
                Service. We take privacy seriously — handling your source code responsibly is core to our product.
              </p>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">1. Information We Collect</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Account data:</strong> name, email, hashed password, subscription status.
                  </li>
                  <li>
                    <strong>Repository metadata:</strong> repository URLs, branch names, commit SHAs, scan history.
                  </li>
                  <li>
                    <strong>Scan results:</strong> file paths, line numbers, detection rule IDs, masked and hashed
                    secret values, risk scores.
                  </li>
                  <li>
                    <strong>Usage data:</strong> IP address, browser type, pages visited, request timing — used for
                    security, rate-limiting, and product analytics.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">2. How We Handle Your Code</h2>
                <p>
                  When you scan a repository, VaultSentry clones it to ephemeral storage, runs detection rules, then
                  deletes the checkout. Only the following is retained:
                </p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>A <strong>SHA-256 hash</strong> of each detected secret (for deduplication).</li>
                  <li>A <strong>masked</strong> value (first and last 4 characters only, the rest starred).</li>
                  <li>File path, line number, and up to 3 lines of surrounding code for the finding snippet.</li>
                </ul>
                <p className="mt-2">
                  The raw secret value is not persisted server-side. Snippets may contain adjacent code — keep this
                  in mind when reviewing findings.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">3. How We Use Your Data</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>Operate the Service: run scans, show results, send alerts, manage your subscription.</li>
                  <li>Improve detection: aggregate, anonymized metrics to refine our detection rules.</li>
                  <li>Security: detect abuse, enforce rate limits, investigate incidents.</li>
                  <li>Communication: transactional emails (verification, receipts, critical alerts). You may
                    opt out of non-essential emails at any time.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">4. Sharing &amp; Third Parties</h2>
                <p>
                  We do not sell your personal data. We share limited data with sub-processors strictly to run the
                  Service:
                </p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li><strong>Supabase</strong> — authentication and primary data store.</li>
                  <li><strong>Cloud infrastructure providers</strong> — hosting scan workers and databases.</li>
                  <li><strong>Payment processor</strong> — subscription billing (card data never touches our servers).</li>
                </ul>
                <p className="mt-2">
                  Each sub-processor is bound by a data-processing agreement with confidentiality and security terms
                  at least as strict as this policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">5. Data Retention</h2>
                <p>
                  Scan results are retained for the lifetime of your account or until you delete them. Closed
                  accounts are purged within 90 days except where retention is required by law (e.g. billing
                  records).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">6. Your Rights</h2>
                <p>Depending on your jurisdiction, you may have the right to:</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Access, correct, or delete your personal data.</li>
                  <li>Export your data in a portable format.</li>
                  <li>Object to or restrict certain processing.</li>
                  <li>Withdraw consent (where processing is based on consent).</li>
                </ul>
                <p className="mt-2">
                  Email{' '}
                  <a href="mailto:privacy@vaultsentry.io" className="text-zinc-900 dark:text-white underline">
                    privacy@vaultsentry.io
                  </a>{' '}
                  to exercise any of these rights.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">7. Security</h2>
                <p>
                  We use encryption in transit (TLS) and at rest, least-privilege access controls, audit logging, and
                  regular security reviews. No system is perfectly secure — if we discover a breach affecting your
                  data, we will notify you and the appropriate authorities as required.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">8. Cookies</h2>
                <p>
                  We use essential cookies for authentication and session management. No third-party advertising or
                  tracking cookies are used.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">9. Children</h2>
                <p>
                  VaultSentry is not directed to individuals under 16. We do not knowingly collect data from
                  children. If you believe a child has provided us data, please contact us and we will delete it.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">10. Changes</h2>
                <p>
                  We may update this Policy as the Service evolves. Material changes will be announced via email or
                  in-product notice before taking effect.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">11. Contact</h2>
                <p>
                  Privacy questions or requests? Email{' '}
                  <a href="mailto:privacy@vaultsentry.io" className="text-zinc-900 dark:text-white underline">
                    privacy@vaultsentry.io
                  </a>.
                </p>
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
