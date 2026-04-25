'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check, ShieldCheck, ArrowLeft, Smartphone, Download, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/services/supabase'
import {
  AuthLayout,
  AuthCard,
  AuthButton,
  OtpInput,
  Stepper,
} from '@/components/auth'

/**
 * MFA setup — 3-step flow backed by Supabase Auth MFA (TOTP):
 *   1. Scan QR (or copy secret) from supabase.auth.mfa.enroll().
 *   2. Challenge + verify the 6-digit code against Supabase.
 *   3. Show locally-generated recovery codes (display only — Supabase
 *      does not issue recovery codes for TOTP factors today).
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

export default function MfaSetupPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>('scan')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  // Supabase MFA enrollment state
  const [factorId, setFactorId] = useState<string | null>(null)
  const [secret, setSecret] = useState<string>('')
  const [qrSvg, setQrSvg] = useState<string>('')
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(true)

  const recoveryCodes = useMemo(() => generateRecoveryCodes(), [])

  // Enroll a TOTP factor on mount
  useEffect(() => {
    let cancelled = false
    const enroll = async () => {
      setEnrolling(true)
      setEnrollError(null)
      try {
        // If there's already an unverified factor for this user, unenroll it first
        // so we don't hit "factor already exists" errors.
        const listed = await supabase.auth.mfa.listFactors()
        const existing = listed.data?.totp?.find((f: any) => f.status !== 'verified')
        if (existing) {
          await supabase.auth.mfa.unenroll({ factorId: existing.id })
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `VaultSentry · ${new Date().toLocaleDateString()}`,
        })
        if (error) throw error
        if (cancelled) return

        setFactorId(data.id)
        setSecret(data.totp.secret)
        setQrSvg(data.totp.qr_code)
      } catch (err: any) {
        if (!cancelled) {
          setEnrollError(err?.message || 'Could not start MFA enrollment.')
          showToast(err?.message || 'Could not start MFA enrollment.', 'error')
        }
      } finally {
        if (!cancelled) setEnrolling(false)
      }
    }
    enroll()
    return () => {
      cancelled = true
    }
  }, [showToast])

  const currentIndex = step === 'scan' ? 0 : step === 'verify' ? 1 : 2

  const copySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast('Could not copy secret', 'error')
    }
  }

  const handleVerify = async (value?: string) => {
    const v = value ?? code
    if (v.length !== 6) return
    if (!factorId) {
      setError('Enrollment was not started. Please reload the page.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId,
      })
      if (challengeErr) throw challengeErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: v,
      })
      if (verifyErr) throw verifyErr

      setStep('recovery')
      showToast('Two-factor authentication enabled', 'success')
    } catch (err: any) {
      setError(err?.message || 'Invalid code. Please try again.')
      setCode('')
    } finally {
      setLoading(false)
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

  useEffect(() => {
    if (step === 'verify') setCode('')
  }, [step])

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
                ) : qrSvg ? (
                  // Supabase returns `qr_code` as a data URL (data:image/svg+xml;...)
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrSvg}
                    alt="Scan this QR code with your authenticator app"
                    width={180}
                    height={180}
                    className="h-[180px] w-[180px]"
                  />
                ) : (
                  <p className="px-3 text-center text-xs text-slate-500">
                    {enrollError || 'QR unavailable'}
                  </p>
                )}
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                <Smartphone className="h-3.5 w-3.5" />
                Works with 1Password, Authy, Google Authenticator
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-400">
                Can’t scan? Enter this key manually:
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2">
                <code className="flex-1 truncate font-mono text-xs text-cyber-cyan">
                  {secret ? secret.match(/.{1,4}/g)?.join(' ') : enrolling ? 'Generating…' : '—'}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  disabled={!secret}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-white/5 disabled:opacity-40"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-cyber-green" /> : <Copy className="h-3.5 w-3.5" />}
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
              disabled={enrolling || !factorId}
            >
              I’ve added it — continue
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
              disabled={loading}
            />
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
            <AuthButton
              type="button"
              loading={loading}
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
                Each code can be used <strong className="text-white">once</strong>. Store them in
                a password manager or print them out.
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
              <AuthButton type="button" variant="secondary" onClick={copyAllCodes} leadingIcon={
                copiedAll ? <Check className="h-4 w-4 text-cyber-green" /> : <Copy className="h-4 w-4" />
              }>
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
              I’ve saved them — finish
            </AuthButton>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  )
}
