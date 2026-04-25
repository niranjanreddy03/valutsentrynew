'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  AuthLayout,
  AuthCard,
  AuthInput,
  AuthButton,
  OAuthButtons,
  Divider,
  MarketingPanel,
  Turnstile,
} from '@/components/auth'

export default function LoginPage() {
  const router = useRouter()
  const { login, loginWithOAuth, isAuthenticated } = useAuth()
  const { showToast } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'github' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaNonce, setCaptchaNonce] = useState(0)
  const captchaEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (isAuthenticated) router.replace('/')
  }, [isAuthenticated, router])

  const canSubmit =
    email.length > 0 &&
    password.length > 0 &&
    !loading &&
    (!captchaEnabled || !!captchaToken)

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError('Please enter your email and password.')
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
      await login(email, password, captchaToken ?? undefined)
      showToast('Welcome back', 'success')
      router.push('/')
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in. Please try again.')
      triggerShake()
      setCaptchaToken(null)
      setCaptchaNonce((n) => n + 1)
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'github' | 'google') => {
    setOauthLoading(provider)
    try {
      await loginWithOAuth(provider)
    } catch (err: any) {
      showToast(err?.message || `${provider} sign-in failed`, 'error')
    } finally {
      setOauthLoading(null)
    }
  }

  return (
    <AuthLayout
      aside={
        <MarketingPanel
          badge="Built for modern engineering teams"
          heading={
            <>
              Welcome back to
              <br />
              <span style={{ color: '#3b82f6' }}>secret-free</span> shipping.
            </>
          }
          lead="Your dashboards, findings, and integrations are right where you left them. Sign in to pick up where you left off."
        />
      }
    >
      <AuthCard
        title="Welcome back"
        subtitle={
          <span className="flex flex-col gap-1.5">
            <Link
              href="/home"
              className="inline-flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: '#a3a3a3' }}
            >
              <ArrowLeft className="h-3 w-3" /> Back to home
            </Link>
            <span>
              New to VaultSentry?{' '}
              <Link
                href="/register"
                className="font-medium transition-colors"
                style={{ color: '#60a5fa' }}
              >
                Create an account
              </Link>
            </span>
          </span>
        }
        shake={shake}
        footer={
          <>
            By continuing you agree to our{' '}
            <Link href="/terms" style={{ color: '#e5e5e5' }}>
              Terms
            </Link>{' '}
            &amp;{' '}
            <Link href="/privacy" style={{ color: '#e5e5e5' }}>
              Privacy
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

          <AuthInput
            name="password"
            type="password"
            label="Password"
            icon={<Lock className="h-4 w-4" />}
            autoComplete="current-password"
            togglePassword
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            trailing={
              <Link
                href="/forgot-password"
                className="text-xs font-medium transition-colors"
                style={{ color: '#60a5fa' }}
              >
                Forgot password?
              </Link>
            }
          />

          {error && (
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
              <span>{error}</span>
            </div>
          )}

          <label
            className="flex cursor-pointer select-none items-center gap-2 text-xs"
            style={{ color: '#a3a3a3' }}
          >
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded text-blue-500 focus:ring-blue-400/40"
              style={{
                borderColor: 'rgba(82, 82, 82, 0.5)',
                background: '#1f1f1f',
              }}
            />
            Keep me signed in on this device
          </label>

          {captchaEnabled && (
            <Turnstile
              resetKey={captchaNonce}
              onVerify={(t) => setCaptchaToken(t)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => {
                setCaptchaToken(null)
                setError(
                  'Captcha could not complete. If you are running locally, add localhost to the Turnstile widget hostnames in Cloudflare, or use Cloudflare test keys for local development.'
                )
              }}
            />
          )}

          <AuthButton type="submit" loading={loading} disabled={!canSubmit}>
            Sign in
          </AuthButton>
        </form>

        <Divider label="or continue with" />

        <OAuthButtons onProvider={handleOAuth} loading={oauthLoading} />
      </AuthCard>
    </AuthLayout>
  )
}
