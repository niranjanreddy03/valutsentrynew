'use client'

import { ArrowLeft, FileQuestion, Home } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="max-w-md w-full text-center">
        {/* 404 Icon */}
        <div 
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(59, 130, 246, 0.15)' }}
        >
          <FileQuestion className="w-10 h-10 text-blue-500" />
        </div>

        {/* 404 Number */}
        <div 
          className="text-8xl font-bold mb-4"
          style={{ 
            background: 'linear-gradient(135deg, var(--text-muted), var(--text-primary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          404
        </div>

        {/* Message */}
        <h1 
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Page Not Found
        </h1>
        <p 
          className="text-base mb-8"
          style={{ color: 'var(--text-muted)' }}
        >
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <button 
            onClick={() => typeof window !== 'undefined' && window.history.back()}
            className="btn btn-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        {/* Quick Links */}
        <div 
          className="mt-10 pt-8"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <p 
            className="text-sm mb-4"
            style={{ color: 'var(--text-muted)' }}
          >
            Quick Links
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { href: '/repositories', label: 'Repositories' },
              { href: '/scans', label: 'Scans' },
              { href: '/secrets', label: 'Findings' },
              { href: '/help', label: 'Help' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-blue-500 hover:text-blue-400 underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
