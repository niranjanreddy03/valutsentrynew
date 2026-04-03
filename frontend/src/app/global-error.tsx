'use client'

import { AlertOctagon, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div 
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #171717 50%, #0a0a0a 100%)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ maxWidth: '448px', width: '100%', textAlign: 'center' }}>
            {/* Error Icon */}
            <div 
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                background: 'rgba(239, 68, 68, 0.15)',
              }}
            >
              <AlertOctagon style={{ width: '40px', height: '40px', color: '#ef4444' }} />
            </div>

            {/* Error Message */}
            <h1 
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '8px',
                color: '#fafafa',
              }}
            >
              Critical Error
            </h1>
            <p 
              style={{
                fontSize: '16px',
                marginBottom: '24px',
                color: '#a3a3a3',
              }}
            >
              The application encountered a critical error and cannot continue. Please try refreshing the page.
            </p>

            {/* Error Details */}
            {process.env.NODE_ENV === 'development' && (
              <div 
                style={{
                  marginBottom: '24px',
                  padding: '16px',
                  borderRadius: '8px',
                  textAlign: 'left',
                  background: '#262626',
                  border: '1px solid #404040',
                  overflow: 'auto',
                  maxHeight: '128px',
                }}
              >
                <p style={{ 
                  fontSize: '14px', 
                  fontFamily: 'monospace', 
                  color: '#ef4444',
                  wordBreak: 'break-all',
                }}>
                  {error.message}
                </p>
                {error.digest && (
                  <p style={{ 
                    fontSize: '12px', 
                    fontFamily: 'monospace', 
                    marginTop: '8px', 
                    color: '#737373' 
                  }}>
                    Digest: {error.digest}
                  </p>
                )}
              </div>
            )}

            {/* Reset Button */}
            <button
              onClick={reset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '500',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.25)',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.35)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(59, 130, 246, 0.25)'
              }}
            >
              <RefreshCw style={{ width: '16px', height: '16px' }} />
              Refresh Page
            </button>

            {/* Help Text */}
            <p 
              style={{
                marginTop: '32px',
                fontSize: '14px',
                color: '#737373',
              }}
            >
              If this problem persists, please contact{' '}
              <a 
                href="mailto:support@VaultSentry.io"
                style={{ color: '#3b82f6', textDecoration: 'underline' }}
              >
                support@VaultSentry.io
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
