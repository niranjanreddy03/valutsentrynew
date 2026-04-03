'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Loader2, ArrowLeft, CheckCircle, Moon, Sun, KeyRound } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const { theme, toggleTheme } = useTheme()
  const { forgotPassword } = useAuth()

  const validate = () => {
    if (!email) {
      setError('Email is required')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format')
      return false
    }
    setError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      await forgotPassword(email)
      setIsSubmitted(true)
      toast.success('Email sent!', 'Check your inbox for reset instructions.')
    } catch (err: any) {
      toast.error('Failed to send email', err.message || 'Please try again')
    } finally {
      setIsLoading(false)
    }
  }

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

      {/* Content */}
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-zinc-900 dark:bg-white mb-4">
              <KeyRound className="w-7 h-7 text-white dark:text-zinc-900" />
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-1">
              {isSubmitted ? 'Check your email' : 'Reset your password'}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              {isSubmitted 
                ? 'We\'ve sent you a password reset link' 
                : 'Enter your email and we\'ll send you a reset link'}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`
                        w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border rounded-lg 
                        text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500
                        focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent
                        transition-all
                        ${error ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-700'}
                      `}
                    />
                  </div>
                  {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="
                    w-full py-3 px-4 rounded-lg font-medium
                    bg-zinc-900 dark:bg-white text-white dark:text-zinc-900
                    hover:bg-zinc-800 dark:hover:bg-zinc-100
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 dark:focus:ring-white
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors flex items-center justify-center gap-2
                  "
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  We&apos;ve sent a password reset link to
                </p>
                <p className="text-zinc-900 dark:text-white font-medium mb-6">
                  {email}
                </p>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Didn&apos;t receive the email? Check your spam folder or{' '}
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="text-zinc-900 dark:text-white font-medium hover:underline"
                    >
                      try again
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Back to Login */}
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 mt-6 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
