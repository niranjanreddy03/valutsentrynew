'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthLayout from '../AuthLayout'
import { ProviderLogo } from '@/components/auth/ProviderLogo'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { clientRateLimit, clientRateLimitReset } from '@/lib/rate-limit'

export default function LoginPage() {
  const router = useRouter()
  const { login, loginWithOAuth, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'github' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard')
  }, [isAuthenticated, router])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const rateLimitMsg = clientRateLimit('login', 5, 60_000)
    if (rateLimitMsg) {
      setError(rateLimitMsg)
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      clientRateLimitReset('login')
      showToast('Welcome back', 'success')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in. Please try again.')
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
      setError(err?.message || `${provider} sign-in failed`)
    } finally {
      setOauthLoading(null)
    }
  }

  return (
    <AuthLayout>
      <section className="vs-card">
        <div className="vs-card-header">
          <div className="vs-shield-badge">
            <span className="material-symbols-outlined">shield_lock</span>
          </div>
          <h1 className="vs-card-title">Welcome back</h1>
          <p className="vs-card-desc">Sign in to continue scanning, triage, and remediation.</p>
        </div>

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

        <div className="vs-divider">or sign in with email</div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }} noValidate>
          <div className="vs-field">
            <label className="vs-label-row" htmlFor="email">Email address</label>
            <input
              id="email"
              className="vs-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="vs-field">
            <div className="vs-label-row">
              <label htmlFor="password">Password</label>
              <Link className="vs-link" href="/forgot-password">Forgot?</Link>
            </div>
            <input
              id="password"
              className="vs-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && <div className="vs-alert">{error}</div>}

          <button className="vs-primary-btn" type="submit" disabled={loading || !email || !password}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="vs-bottom-text">
          New to TheVaultSentry? <Link className="vs-link" href="/signup">Create an account</Link>
        </p>
      </section>
    </AuthLayout>
  )
}
