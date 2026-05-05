'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Copy,
  Check,
  ShieldCheck,
  ArrowLeft,
  Smartphone,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/services/supabase'
import {
  buildOtpAuthUri,
  generateTotpSecret,
  saveLocalMfaFactor,
  verifyTotpCode,
} from '@/lib/localMfa'
import {
  AuthLayout,
  AuthCard,
  AuthButton,
  OtpInput,
  Stepper,
} from '@/components/auth'

/**
 * MFA setup — 3-step flow:
 *   1. Scan: enroll a TOTP factor and show QR / setup key.
 *   2. Verify: challenge + verify the 6-digit code.
 *   3. Recovery: show locally-generated recovery codes.
 *
 * Backed by Supabase Auth MFA when a real session exists, otherwise falls
 * back to a localStorage TOTP factor for the no-Supabase dev path.
 */

type Step = 'scan' | 'verify' | 'recovery'
const STEPS = ['Scan', 'Verify', 'Recovery']

function generateRecoveryCodes() {
  const codes: string[] = []
  for (let i = 0; i < 8; i++) {
    const a = Math.random().toString(36).slice(2, 7)
    const b = Math.random().toString(36).slice(2, 7)
    codes.push(`${a}-${b}`.toLowerCase())
  }
  return codes
}

function toQrImageSrc(qrCode: string) {
  const trimmed = (qrCode || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('<svg')) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`
  }
  return trimmed
}

interface EnrollmentResult {
  factorId: string
  secret: string
  qr: string
  otpAuthUri: string
  isLocal: boolean
}

export default function MfaSetupPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { user, supabaseUser, isLoading: authLoading } = useAuth()

  const [step, setStep] = useState<Step>('scan')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  const [enrollment, setEnrollment] = useState<EnrollmentResult | null>(null)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(true)
  const [enrollAttempt, setEnrollAttempt] = useState(0)

  const recoveryCodes = useMemo(() => generateRecoveryCodes(), [])

  // Refs for latest auth values without making them effect deps.
  const userRef = useRef(user)
  const supabaseUserRef = useRef(supabaseUser)
  useEffect(() => {
    userRef.current = user
    supabaseUserRef.current = supabaseUser
  }, [user, supabaseUser])

  // Run enrollment exactly once per attempt — only when auth is settled.
  // We deliberately do NOT include user/session in deps because
  // MFA_CHALLENGE_VERIFIED fires after a successful verify and would
  // otherwise re-trigger this effect, wiping the just-enrolled factor.
  useEffect(() => {
    if (authLoading) return

    let aborted = false

    const run = async () => {
      setEnrolling(true)
      setEnrollError(null)
      try {
        const result = await performEnrollment(userRef.current, supabaseUserRef.current)
        if (aborted) return
        setEnrollment(result)
      } catch (err: any) {
        console.error('[MFA SETUP] enrollment failed:', err)
        if (!aborted) {
          setEnrollError(err?.message || 'Could not start MFA enrollment.')
          showToast(err?.message || 'Could not start MFA enrollment.', 'error')
        }
      } finally {
        if (!aborted) setEnrolling(false)
      }
    }

    run()
    return () => {
      aborted = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, enrollAttempt])

  const verifyingRef = useRef(false)
  const handleVerify = async (value?: string) => {
    const v = (value ?? code).trim()
    if (v.length !== 6) return
    if (!enrollment) {
      setError('Enrollment was not started. Please reload the page.')
      return
    }
    // Prevent concurrent calls (OtpInput.onComplete + button click race).
    if (verifyingRef.current) return
    verifyingRef.current = true

    console.log('[MFA SETUP] verify start, factorId:', enrollment.factorId, 'isLocal:', enrollment.isLocal)
    setError(null)
    setVerifying(true)
    try {
      if (enrollment.isLocal) {
        const valid = await verifyTotpCode(enrollment.secret, v)
        if (!valid) throw new Error('Invalid code. Please try again.')

        const userId = userRef.current?.id || supabaseUserRef.current?.id
        if (!userId) throw new Error('Local user not found. Please sign in again.')
        saveLocalMfaFactor(userId, {
          secret: enrollment.secret,
          issuer: 'VaultSentry',
          accountName:
            userRef.current?.email || supabaseUserRef.current?.email || 'local-user',
          verifiedAt: new Date().toISOString(),
        })
      } else {
        const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
          Promise.race([
            p,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
            ),
          ])

        console.log('[MFA SETUP] calling mfa.challenge…')
        const { data: challenge, error: challengeErr } = await withTimeout(
          supabase.auth.mfa.challenge({ factorId: enrollment.factorId }),
          15_000,
          'mfa.challenge',
        )
        if (challengeErr) throw challengeErr
        if (!challenge) throw new Error('Challenge returned no data.')
        console.log('[MFA SETUP] challenge ok, id:', challenge.id, 'calling mfa.verify…')

        const { error: verifyErr } = await withTimeout(
          supabase.auth.mfa.verify({
            factorId: enrollment.factorId,
            challengeId: challenge.id,
            code: v,
          }),
          15_000,
          'mfa.verify',
        )
        if (verifyErr) throw verifyErr
        console.log('[MFA SETUP] verify ok')
      }

      showToast('Two-factor authentication enabled', 'success')
      setStep('recovery')
    } catch (err: any) {
      console.error('[MFA SETUP] verify failed:', err)
      setError(err?.message || 'Invalid code. Please try again.')
      setCode('')
    } finally {
      verifyingRef.current = false
      setVerifying(false)
    }
  }

  const copySecret = async () => {
    if (!enrollment?.secret) return
    try {
      await navigator.clipboard.writeText(enrollment.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast('Could not copy secret', 'error')
    }
  }

  const copyAllCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'))
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      showToast('Could not copy codes', 'error')
    }
  }

  const downloadCodes = () => {
    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vaultsentry-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDone = () => {
    router.push('/settings')
  }

  const retryEnrollment = () => {
    setEnrollment(null)
    setEnrollAttempt((n) => n + 1)
  }

  useEffect(() => {
    if (step === 'verify') setCode('')
  }, [step])

  const currentIndex = step === 'scan' ? 0 : step === 'verify' ? 1 : 2
  const qrSrc = enrollment?.qr ? toQrImageSrc(enrollment.qr) : ''
  const formattedSecret = enrollment?.secret
    ? enrollment.secret.match(/.{1,4}/g)?.join(' ')
    : null

  return (
    <AuthLayout>
      <AuthCard
        title={
          step === 'scan'
            ? 'Set up two-factor auth'
            : step === 'verify'
            ? 'Enter a 6-digit code'
            : 'Save your recovery codes'
        }
        subtitle={
          step === 'scan'
            ? 'Scan this QR code with your authenticator app, or paste the setup key.'
            : step === 'verify'
            ? 'Open your authenticator and enter the current code for VaultSentry.'
            : 'Keep these codes somewhere safe. Each one can be used once if you lose your device.'
        }
      >
        <div className="mb-6">
          <Stepper steps={STEPS} current={currentIndex} />
        </div>

        {step === 'scan' && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex h-[204px] w-[204px] items-center justify-center rounded-lg bg-white p-3 shadow-glow-sm">
                {enrolling ? (
                  <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                ) : qrSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrSrc}
                    alt="Scan this QR code with your authenticator app"
                    width={180}
                    height={180}
                    className="h-[180px] w-[180px]"
                  />
                ) : enrollment?.otpAuthUri ? (
                  <p className="px-3 text-center text-xs text-slate-500">
                    Use the setup key below
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-2 px-3 text-center">
                    <p className="text-xs text-slate-500">
                      {enrollError || 'QR unavailable'}
                    </p>
                    <button
                      type="button"
                      onClick={retryEnrollment}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      <RefreshCw className="h-3 w-3" /> Retry
                    </button>
                  </div>
                )}
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                <Smartphone className="h-3.5 w-3.5" />
                Works with 1Password, Authy, Google Authenticator
              </div>
            </div>

            {enrollment?.otpAuthUri && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-400">
                  Authenticator setup URI:
                </p>
                <code className="block break-all rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
                  {enrollment.otpAuthUri}
                </code>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-400">
                Can&rsquo;t scan? Enter this key manually:
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2">
                <code className="flex-1 truncate font-mono text-xs text-cyber-cyan">
                  {formattedSecret ?? (enrolling ? 'Generating…' : '—')}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  disabled={!enrollment?.secret}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-white/5 disabled:opacity-40"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-cyber-green" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {enrollError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {enrollError}
              </div>
            )}

            <AuthButton
              type="button"
              onClick={() => setStep('verify')}
              disabled={enrolling || !enrollment}
            >
              I&rsquo;ve added it &mdash; continue
            </AuthButton>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Set up later
            </Link>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-5">
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={(v) => handleVerify(v)}
              error={!!error}
              disabled={verifying}
            />
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
            <AuthButton
              type="button"
              loading={verifying}
              disabled={code.length !== 6}
              onClick={() => handleVerify()}
            >
              Verify and enable
            </AuthButton>
            <button
              type="button"
              onClick={() => setStep('scan')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to QR code
            </button>
          </div>
        )}

        {step === 'recovery' && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-cyber-cyan/20 bg-cyber-cyan/5 p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyber-cyan" />
              <p className="text-xs leading-relaxed text-slate-300">
                Each code can be used <strong className="text-white">once</strong>. Store
                them in a password manager or print them out.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-slate-900/70 p-4 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <div key={c} className="text-slate-200">
                  {c}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <AuthButton
                type="button"
                variant="secondary"
                onClick={copyAllCodes}
                leadingIcon={
                  copiedAll ? (
                    <Check className="h-4 w-4 text-cyber-green" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )
                }
              >
                {copiedAll ? 'Copied' : 'Copy all'}
              </AuthButton>
              <AuthButton
                type="button"
                variant="secondary"
                onClick={downloadCodes}
                leadingIcon={<Download className="h-4 w-4" />}
              >
                Download .txt
              </AuthButton>
            </div>

            <AuthButton type="button" onClick={handleDone}>
              I&rsquo;ve saved them &mdash; finish
            </AuthButton>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  )
}

/**
 * Performs an MFA enrollment end-to-end:
 *   1. If there is no Supabase session but we have a local user, do a local
 *      TOTP enrollment (dev fallback).
 *   2. Otherwise, list & unenroll any existing factors so we never collide on
 *      friendly_name, then call mfa.enroll() and return the QR + secret.
 *
 * This is a plain async function (not inside an effect closure) so React's
 * strict-mode double-invocation can't cancel it midway and leave state empty.
 */
async function performEnrollment(
  user: { id?: string; email?: string } | null,
  supabaseUser: { id?: string; email?: string } | null,
): Promise<EnrollmentResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const activeSession = sessionData.session

  // Local-only fallback: no Supabase session but we have a local user.
  if (!activeSession && (user || supabaseUser)) {
    const accountName = user?.email || supabaseUser?.email || 'local-user'
    const localSecret = generateTotpSecret()
    return {
      factorId: `local:${user?.id || supabaseUser?.id || accountName}`,
      secret: localSecret,
      qr: '',
      otpAuthUri: buildOtpAuthUri(localSecret, accountName),
      isLocal: true,
    }
  }

  if (!activeSession) {
    throw new Error('No active session. Please sign in again.')
  }

  // Clean slate: remove any pre-existing factors so enroll() can't fail on
  // the unique (user_id, friendly_name) constraint.
  try {
    const listed = await supabase.auth.mfa.listFactors()
    const factors = listed.data?.totp ?? []
    for (const f of factors) {
      await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {})
    }
  } catch (err) {
    console.warn('[MFA SETUP] listFactors/unenroll cleanup failed:', err)
  }

  const friendlyName = `VaultSentry · ${new Date().toLocaleDateString()} · ${Date.now()}`
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  })
  if (error) throw error
  if (!data) throw new Error('Enrollment returned no data.')

  return {
    factorId: data.id,
    secret: data.totp.secret,
    qr: data.totp.qr_code,
    otpAuthUri: data.totp.uri || '',
    isLocal: false,
  }
}
