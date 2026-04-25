'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, ArrowLeft, CheckCircle2, KeyRound, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  AuthLayout,
  AuthCard,
  AuthInput,
  AuthButton,
  OtpInput,
  PasswordStrength,
  scoreOf,
  Stepper,
  StepFade,
  Turnstile,
} from '@/components/auth'

type Step = 'email' | 'otp' | 'reset' | 'done'
const STEPS = ['Email', 'Code', 'New password']

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { forgotPassword, verifyOtp, resendOtp, resetPassword } = useAuth()
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaNonce, setCaptchaNonce] = useState(0)
  const captchaEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const currentIndex = step === 'email' ? 0 : step === 'otp' ? 1 : 2
  const passwordsMatch = password.length > 0 && password === confirmPassword

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email) {
      setError('Please enter your email.')
      triggerShake()
      return
    }
    if (captchaEnabled && !captchaToken) {
      setError('Please complete the captcha.')
      triggerShake()
      return
    }
    setLoading(true)
    try {
      await forgotPassword(email, captchaToken ?? undefined)
      setStep('otp')
      setResendCooldown(30)
      showToast('Check your inbox for a reset code', 'success')
    } catch (err: any) {
      setError(err?.message || 'Unable to send reset email.')
      triggerShake()
      setCaptchaToken(null)
      setCaptchaNonce((n) => n + 1)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (code?: string) => {
    const value = code ?? otp
    if (value.length !== 6) return
    setError(null)
    setLoading(true)
    try {
      await verifyOtp(email, value, 'recovery')
      setStep('reset')
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired code.')
      setOtp('')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      await resendOtp(email, 'recovery')
      setResendCooldown(30)
      showToast('New code sent', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Failed to resend code', 'error')
    }
  }

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (scoreOf(password) < 3) {
      setError('Please choose a stronger password.')
      triggerShake()
      return
    }
    if (!passwordsMatch) {
      setError('Passwords don’t match.')
      triggerShake()
      return
    }
    setLoading(true)
    try {
      await resetPassword(password)
      setStep('done')
      setTimeout(() => router.push('/login'), 1800)
    } catch (err: any) {
      setError(err?.message || 'Unable to reset password.')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const errorBanner = (msg: string) => (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
      style={{
        border: '1px solid rgba(239, 68, 68, 0.3)',
        background: 'rgba(239, 68, 68, 0.08)',
        color: '#fca5a5',
      }}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{msg}</span>
    </div>
  )

  return (
    <AuthLayout>
      <AuthCard
        title={
          step === 'email'
            ? 'Reset your password'
            : step === 'otp'
            ? 'Enter your code'
            : step === 'reset'
            ? 'Choose a new password'
            : 'Password updated'
        }
        subtitle={
          step === 'email' ? (
            'Enter your email and we’ll send a 6-digit code to reset it.'
          ) : step === 'otp' ? (
            <>
              We sent a 6-digit code to <span style={{ color: '#fafafa' }}>{email}</span>
            </>
          ) : step === 'reset' ? (
            'Pick something strong — you won’t need to do this often.'
          ) : (
            'Redirecting you to sign in…'
          )
        }
        shake={shake}
        footer={
          step === 'email' ? (
            <>
              Remember it?{' '}
              <Link
                href="/login"
                className="font-medium"
                style={{ color: '#60a5fa' }}
              >
                Back to sign in
              </Link>
            </>
          ) : step === 'otp' ? (
            <>
              Didn’t get it?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="font-medium disabled:opacity-60"
                style={{ color: resendCooldown > 0 ? '#a3a3a3' : '#60a5fa' }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </>
          ) : null
        }
      >
        {step !== 'done' && (
          <div className="mb-7">
            <Stepper steps={STEPS} current={currentIndex} />
          </div>
        )}

        <StepFade stepKey={step}>
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
              <AuthInput
                name="email"
                type="email"
                label="Email address"
                icon={<Mail className="h-4 w-4" />}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {captchaEnabled && (
                <Turnstile
                  resetKey={captchaNonce}
                  onVerify={(t) => setCaptchaToken(t)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              )}
              {error && errorBanner(error)}
              <AuthButton
                type="submit"
                loading={loading}
                disabled={!email || loading || (captchaEnabled && !captchaToken)}
                leadingIcon={<KeyRound className="h-4 w-4" />}
              >
                Send reset code
              </AuthButton>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs transition-colors" style={{ color: '#a3a3a3' }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </form>
          )}

          {step === 'otp' && (
            <div className="space-y-5">
              <OtpInput
                value={otp}
                onChange={setOtp}
                onComplete={(code) => handleOtpSubmit(code)}
                error={!!error}
                disabled={loading}
              />
              {error && errorBanner(error)}
              <AuthButton
                type="button"
                loading={loading}
                disabled={otp.length !== 6}
                onClick={() => handleOtpSubmit()}
              >
                Verify code
              </AuthButton>
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setOtp('')
                  setError(null)
                }}
                className="inline-flex items-center gap-1.5 text-xs transition-colors" style={{ color: '#a3a3a3' }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
              </button>
            </div>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-4" noValidate>
              <AuthInput
                name="password"
                type="password"
                label="New password"
                icon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
                togglePassword
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <PasswordStrength password={password} />
              <AuthInput
                name="confirmPassword"
                type="password"
                label="Confirm new password"
                icon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
                togglePassword
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                error={
                  confirmPassword.length > 0 && !passwordsMatch
                    ? 'Passwords don’t match'
                    : undefined
                }
              />
              {error && errorBanner(error)}
              <AuthButton
                type="submit"
                loading={loading}
                disabled={scoreOf(password) < 3 || !passwordsMatch}
              >
                Update password
              </AuthButton>
            </form>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-6 text-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_24px_rgba(16,185,129,0.25)]"
                style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
              >
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <p className="mt-4 text-sm" style={{ color: '#e5e5e5' }}>Your password has been updated.</p>
            </div>
          )}
        </StepFade>
      </AuthCard>
    </AuthLayout>
  )
}
