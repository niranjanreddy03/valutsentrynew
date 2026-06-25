'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthLayout from '../AuthLayout'
import { ProviderLogo } from '@/components/auth/ProviderLogo'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { clientRateLimit } from '@/lib/rate-limit'

export default function RegisterPage() {
  const router = useRouter()
  const { register, verifyOtp, resendOtp, loginWithOAuth, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [step, setStep] = useState<'details' | 'verify'>('details')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'github' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard')
  }, [isAuthenticated, router])

  const canCreate =
    fullName.trim() &&
    email.trim() &&
    password.length >= 8 &&
    password === confirmPassword &&
    acceptTerms

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    const rateLimitMsg = clientRateLimit('register', 3, 60_000)
    if (rateLimitMsg) {
      setError(rateLimitMsg)
      return
    }

    setLoading(true)
    try {
      await register(email, password, fullName.trim())
      setStep('verify')
      showToast('Verification code sent', 'success')
    } catch (err: any) {
      setError(err?.message || 'Unable to create your account.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    if (otp.length !== 6) return
    setLoading(true)
    setError(null)
    try {
      await verifyOtp(email, otp)
      showToast('Email verified', 'success')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired verification code.')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'github' | 'google') => {
    setOauthLoading(provider)
    setError(null)
    try {
      await loginWithOAuth(provider)
    } catch (err: any) {
      setError(err?.message || `${provider} sign-up failed`)
    } finally {
      setOauthLoading(null)
    }
  }

  return (
    <AuthLayout>
      <section className="vs-card">
        <div className="vs-card-header">
          <div className="vs-shield-badge">
            <span className="material-symbols-outlined">encrypted</span>
          </div>
          <h1 className="vs-card-title">{step === 'details' ? 'Create your account' : 'Verify your email'}</h1>
          <p className="vs-card-desc">
            {step === 'details'
              ? 'Start with repository scanning and secret remediation in minutes.'
              : `Enter the 6-digit code sent to ${email}.`}
          </p>
        </div>

        {step === 'details' ? (
          <>
            <div className="vs-oauth-row">
              <button className="vs-oauth-btn" type="button" disabled={!!oauthLoading} onClick={() => handleOAuth('github')}>
                <ProviderLogo provider="github" />
                GitHub
              </button>
              <button className="vs-oauth-btn" type="button" disabled={!!oauthLoading} onClick={() => handleOAuth('google')}>
                <ProviderLogo provider="google" />
                Google
              </button>
            </div>

            <div className="vs-divider">or sign up with email</div>

            <form onSubmit={handleCreate} style={{ display: 'grid', gap: 14 }} noValidate>
              <div className="vs-field">
                <label className="vs-label-row" htmlFor="fullName">Full name</label>
                <input id="fullName" className="vs-input" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
              </div>
              <div className="vs-field">
                <label className="vs-label-row" htmlFor="email">Work email</label>
                <input id="email" className="vs-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="vs-field">
                <label className="vs-label-row" htmlFor="password">Password</label>
                <input id="password" className="vs-input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              <div className="vs-field">
                <label className="vs-label-row" htmlFor="confirmPassword">Confirm password</label>
                <input id="confirmPassword" className="vs-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </div>

              <label className="vs-checkbox-row">
                <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
                <span>I agree to the <Link className="vs-link" href="/terms">Terms</Link> and <Link className="vs-link" href="/privacy">Privacy Policy</Link>.</span>
              </label>

              {error && <div className="vs-alert">{error}</div>}

              <button className="vs-primary-btn" type="submit" disabled={loading || !canCreate}>
                {loading ? 'Creating...' : 'Create account'}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleVerify} style={{ display: 'grid', gap: 14 }} noValidate>
            <div className="vs-field">
              <label className="vs-label-row" htmlFor="otp">Verification code</label>
              <input
                id="otp"
                className="vs-input"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            {error && <div className="vs-alert">{error}</div>}
            <button className="vs-primary-btn" type="submit" disabled={loading || otp.length !== 6}>
              {loading ? 'Verifying...' : 'Verify email'}
            </button>
            <button className="vs-oauth-btn" type="button" disabled={loading} onClick={() => resendOtp(email)}>
              Resend code
            </button>
          </form>
        )}

        <p className="vs-bottom-text">
          Already have an account? <Link className="vs-link" href="/login">Sign in</Link>
        </p>
      </section>
    </AuthLayout>
  )
}
