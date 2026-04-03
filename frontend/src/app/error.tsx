'use client'

import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div 
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(239, 68, 68, 0.15)' }}
        >
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>

        {/* Error Message */}
        <h1 
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Something went wrong
        </h1>
        <p 
          className="text-base mb-6"
          style={{ color: 'var(--text-muted)' }}
        >
          An unexpected error occurred. Our team has been notified and is working to fix the issue.
        </p>

        {/* Error Details (in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div 
            className="mb-6 p-4 rounded-lg text-left overflow-auto max-h-32"
            style={{ 
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)'
            }}
          >
            <p className="text-sm font-mono text-red-400 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs font-mono mt-2" style={{ color: 'var(--text-muted)' }}>
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="btn btn-primary"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link href="/" className="btn btn-secondary">
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>

        {/* Support Link */}
        <p 
          className="mt-8 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Need help?{' '}
          <Link 
            href="/help" 
            className="text-blue-500 hover:text-blue-400 underline"
          >
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  )
}
