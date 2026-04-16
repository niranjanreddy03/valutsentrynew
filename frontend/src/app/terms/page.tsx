'use client'

import Link from 'next/link'
import { Shield, Moon, Sun, ArrowLeft } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              Last updated: April 15, 2026
            </p>
          </div>

          {/* Content Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 sm:p-10 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <article className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">1. Acceptance of Terms</h2>
                <p>
                  By creating an account or using VaultSentry (the &ldquo;Service&rdquo;), you agree to be bound by these
                  Terms of Service. If you do not agree, you may not access or use the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">2. The Service</h2>
                <p>
                  VaultSentry scans source code, repositories, and configuration files to detect leaked secrets and
                  credentials. You are responsible for ensuring you have authorization to scan any repository or
                  artifact you submit.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">3. Accounts</h2>
                <p>
                  You must provide accurate information when creating an account and keep your credentials
                  confidential. You are responsible for all activity under your account. Notify us immediately of
                  any unauthorized use.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">4. Acceptable Use</h2>
                <p>You agree not to:</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Scan repositories, systems, or artifacts you do not own or lack written permission to scan.</li>
                  <li>Use the Service to harm, defraud, or misrepresent any person or organization.</li>
                  <li>Reverse-engineer, resell, or redistribute the Service without written consent.</li>
                  <li>Attempt to disrupt or compromise the Service, its infrastructure, or other users.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">5. Your Content</h2>
                <p>
                  You retain all rights to code and content you submit. You grant VaultSentry a limited license to
                  process that content solely to operate the Service (run scans, generate reports, deliver results).
                  Detected secrets are stored in hashed or masked form where possible.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">6. Subscription &amp; Billing</h2>
                <p>
                  Paid plans are billed in advance on a recurring basis. You may cancel at any time — cancellation
                  takes effect at the end of the current billing period. Fees paid are non-refundable except where
                  required by law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">7. Disclaimer</h2>
                <p>
                  The Service is provided &ldquo;as is&rdquo; without warranty of any kind. Secret-detection is heuristic and
                  may produce false positives or miss real secrets. VaultSentry is a defense-in-depth tool — it does
                  not replace secure development practices, code review, or incident response.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">8. Limitation of Liability</h2>
                <p>
                  To the maximum extent permitted by law, VaultSentry shall not be liable for any indirect,
                  incidental, consequential, or special damages arising from your use of the Service. Our total
                  liability for any claim is limited to the amount you paid us in the twelve months preceding the
                  claim.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">9. Termination</h2>
                <p>
                  We may suspend or terminate your access if you breach these Terms or use the Service in a way that
                  exposes us or other users to harm. You may close your account at any time from account settings.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">10. Changes</h2>
                <p>
                  We may update these Terms from time to time. If we make material changes, we will notify you by
                  email or in-product notice. Continued use of the Service after the effective date constitutes
                  acceptance.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">11. Contact</h2>
                <p>
                  Questions about these Terms? Email{' '}
                  <a href="mailto:legal@vaultsentry.io" className="text-zinc-900 dark:text-white underline">
                    legal@vaultsentry.io
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
                href="/privacy"
                className="text-sm font-medium text-zinc-900 dark:text-white hover:underline"
              >
                Privacy Policy →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
