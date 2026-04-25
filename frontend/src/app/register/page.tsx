'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Mail,
  Lock,
  User,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
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
  OAuthButtons,
  Divider,
  StepFade,
  MarketingPanel,
  Turnstile,
} from '@/components/auth'

type Step = 'basic' | 'otp' | 'mfa' | 'done'
const STEP_LABELS = ['Your details', 'Verify email', 'Secure account']

export default function RegisterPage() {
  const router = useRouter()
  const { register, verifyOtp, resendOtp, loginWithOAuth, isAuthenticated } = useAuth()
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>('basic')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [otp, setOtp] = useState('')
  const [enableMfa, setEnableMfa] = useState(true)

  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'github' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaNonce, setCaptchaNonce] = useState(0)
  const captchaEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (isAuthenticated) router.replace('/')
  }, [isAuthenticated, router])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const currentIndex = step === 'basic' ? 0 : step === 'otp' ? 1 : 2
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const formValid =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    scoreOf(password) >= 3 &&
    passwordsMatch &&
    acceptTerms &&
    (!captchaEnabled || !!captchaToken)

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleBasicSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) return setError('Please enter your full name.')
    if (!email.trim()) return setError('Please enter your email.')
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
    if (!acceptTerms) {
      setError('You must accept the Terms and Privacy Policy to continue.')
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
      await register(email, password, fullName.trim(), captchaToken ?? undefined)
      setStep('otp')
      setResendCooldown(30)
      showToast('We sent a verification code to your email.', 'success')
    } catch (err: any) {
      setError(err?.message || 'Unable to create your account.')
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
      await verifyOtp(email, value)
      setStep('mfa')
      showToast('Email verified', 'success')
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
      await resendOtp(email)
      setResendCooldown(30)
      showToast('New code sent', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Failed to resend code', 'error')
    }
  }

  const handleMfaContinue = () => {
    if (enableMfa) {
      router.push('/mfa-setup')
    } else {
      setStep('done')
      setTimeout(() => router.push('/'), 1200)
    }
  }

  const handleOAuth = async (provider: 'github' | 'google') => {
    setOauthLoading(provider)
    try {
      await loginWithOAuth(provider)
    } catch (err: any) {
      showToast(err?.message || `${provider} sign-up failed`, 'error')
    } finally {
      setOauthLoading(null)
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
    <AuthLayout
      aside={
        <MarketingPanel
          badge="Free trial · No credit card required"
          heading={
            <>
              Ship faster.
              <br />
              <span style={{ color: '#3b82f6' }}>Leak nothing.</span>
            </>
          }
          lead="Create a VaultSentry account to connect your first repository. We scan every commit, validate every finding, and alert you the moment something sensitive slips through."
        />
      }
    >
      <AuthCard
        title={
          step === 'basic'
            ? 'Create your account'
            : step === 'otp'
            ? 'Verify your email'
            : step === 'mfa'
            ? 'Secure your account'
            : 'You’re all set'
        }
        subtitle={
          step === 'basic' ? (
            <span className="flex flex-col gap-1.5">
              <Link
                href="/home"
                className="inline-flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: '#a3a3a3' }}
              >
                <ArrowLeft className="h-3 w-3" /> Back to home
              </Link>
              <span>
                Already have one?{' '}
                <Link
                  href="/login"
                  className="font-medium transition-colors"
                  style={{ color: '#60a5fa' }}
                >
                  Sign in
                </Link>
              </span>
            </span>
          ) : step === 'otp' ? (
            <>
              We sent a 6-digit code to{' '}
              <span style={{ color: '#fafafa' }}>{email}</span>
            </>
          ) : step === 'mfa' ? (
            'Add an extra layer of protection. Recommended, not required.'
          ) : (
            'Taking you to your dashboard…'
          )
        }
        shake={shake}
        footer={
          step === 'basic' ? (
            <>
              By creating an account you agree to our{' '}
              <Link href="/terms" style={{ color: '#e5e5e5' }}>
                Terms
              </Link>{' '}
              &amp;{' '}
              <Link href="/privacy" style={{ color: '#e5e5e5' }}>
                Privacy
              </Link>
            </>
          ) : step === 'otp' ? (
            <>
              Didn’t get it?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="font-medium transition-colors disabled:opacity-60"
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
            <Stepper steps={STEP_LABELS} current={currentIndex} />
          </div>
        )}

        <StepFade stepKey={step}>
          {step === 'basic' && (
            <>
              <form onSubmit={handleBasicSubmit} className="space-y-4" noValidate>
                <AuthInput
                  name="fullName"
                  label="Full name"
                  icon={<User className="h-4 w-4" />}
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <AuthInput
                  name="email"
                  type="email"
                  label="Work email"
                  icon={<Mail className="h-4 w-4" />}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="space-y-2">
                  <AuthInput
                    name="password"
                    type="password"
                    label="Password"
                    icon={<Lock className="h-4 w-4" />}
                    autoComplete="new-password"
                    togglePassword
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <PasswordStrength password={password} />
                </div>

                <AuthInput
                  name="confirmPassword"
                  type="password"
                  label="Confirm password"
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

                <label
                  className="flex cursor-pointer select-none items-start gap-2 text-xs leading-relaxed"
                  style={{ color: '#a3a3a3' }}
                >
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-blue-500 focus:ring-blue-400/40"
                    style={{
                      borderColor: 'rgba(82, 82, 82, 0.5)',
                      background: '#1f1f1f',
                    }}
                  />
                  <span>
                    I agree to the{' '}
                    <Link
                      href="/terms"
                      className="underline-offset-2 hover:underline"
                      style={{ color: '#fafafa' }}
                    >
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy"
                      className="underline-offset-2 hover:underline"
                      style={{ color: '#fafafa' }}
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                {captchaEnabled && (
                  <Turnstile
                    resetKey={captchaNonce}
                    onVerify={(t) => setCaptchaToken(t)}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => setCaptchaToken(null)}
                  />
                )}

                <AuthButton type="submit" loading={loading} disabled={!formValid}>
                  Create account
                </AuthButton>
              </form>

              <Divider label="or sign up with" />
              <OAuthButtons onProvider={handleOAuth} loading={oauthLoading} />
            </>
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
                Verify email
              </AuthButton>
              <button
                type="button"
                onClick={() => {
                  setStep('basic')
                  setOtp('')
                  setError(null)
                }}
                className="inline-flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: '#a3a3a3' }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
              </button>
            </div>
          )}

          {step === 'mfa' && (
            <div className="space-y-5">
              <label
                className="flex cursor-pointer items-start gap-3 rounded-xl p-4 transition-colors"
                style={{
                  border: '1px solid rgba(82, 82, 82, 0.5)',
                  background: '#1f1f1f',
                }}
              >
                <input
                  type="checkbox"
                  checked={enableMfa}
                  onChange={(e) => setEnableMfa(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-blue-500 focus:ring-blue-400/40"
                  style={{
                    borderColor: 'rgba(82, 82, 82, 0.5)',
                    background: '#262626',
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" style={{ color: '#3b82f6' }} />
                    <span className="text-sm font-medium" style={{ color: '#fafafa' }}>
                      Enable two-factor authentication
                    </span>
                  </div>
                  <p
                    className="mt-1 text-xs leading-relaxed"
                    style={{ color: '#a3a3a3' }}
                  >
                    Use an authenticator app like 1Password, Authy, or Google Authenticator. You
                    can turn this off later in Settings.
                  </p>
                </div>
              </label>

              <AuthButton type="button" onClick={handleMfaContinue}>
                {enableMfa ? 'Continue to setup' : 'Finish and go to dashboard'}
              </AuthButton>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_24px_rgba(16,185,129,0.25)]"
                style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
              >
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <p className="mt-4 text-sm" style={{ color: '#e5e5e5' }}>Account ready. Taking you in…</p>
            </div>
          )}
        </StepFade>
      </AuthCard>
    </AuthLayout>
  )
}
