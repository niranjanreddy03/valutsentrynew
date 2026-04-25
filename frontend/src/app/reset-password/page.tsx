'use client'

import {
  AuthButton,
  AuthCard,
  AuthInput,
  AuthLayout,
  PasswordStrength,
  scoreOf,
} from '@/components/auth'
import { useAuth } from '@/contexts/AuthContext'
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { resetPassword, session, refreshSession } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    refreshSession()
      .catch((err: any) => {
        if (mounted) {
          setError(err?.message || 'Could not load your reset session. Please request a new reset link.')
        }
      })
      .finally(() => {
        if (mounted) setCheckingSession(false)
      })

    return () => {
      mounted = false
    }
  }, [refreshSession])

  const passwordsMatch = password.length > 0 && password === confirmPassword

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (scoreOf(password) < 3) {
      setError('Please choose a stronger password.')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await resetPassword(password)
      setDone(true)
      setTimeout(() => router.push('/login'), 1600)
    } catch (err: any) {
      setError(err?.message || 'Unable to update password. Please request a new reset link.')
    } finally {
      setLoading(false)
    }
  }

  const errorBanner = (message: string) => (
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
      <span>{message}</span>
    </div>
  )

  return (
    <AuthLayout>
      <AuthCard
        title={done ? 'Password updated' : 'Choose a new password'}
        subtitle={
          done
            ? 'Redirecting you to sign in...'
            : 'Enter a strong new password for your account.'
        }
        footer={
          <Link href="/login" className="font-medium" style={{ color: '#60a5fa' }}>
            Back to sign in
          </Link>
        }
      >
        {done ? (
          <div className="flex flex-col items-center py-6 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_24px_rgba(16,185,129,0.25)]"
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
            >
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="mt-4 text-sm" style={{ color: '#e5e5e5' }}>
              Your password has been updated.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {!checkingSession && !session && errorBanner('This reset link is invalid or expired. Request a new password reset email.')}
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
                  ? 'Passwords do not match'
                  : undefined
              }
            />
            {error && errorBanner(error)}
            <AuthButton
              type="submit"
              loading={loading}
              disabled={checkingSession || !session || scoreOf(password) < 3 || !passwordsMatch}
            >
              {checkingSession ? 'Checking reset link...' : 'Update password'}
            </AuthButton>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  )
}
