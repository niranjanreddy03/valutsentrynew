import { Shield } from 'lucide-react'

export default function Loading() {
  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="text-center">
        {/* Animated Logo */}
        <div className="relative mb-6">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ 
              background: 'var(--bg-tertiary)', 
              border: '1px solid var(--border-color)',
              animation: 'pulse 2s ease-in-out infinite'
            }}
          >
            <Shield className="w-8 h-8" style={{ color: 'var(--accent)' }} />
          </div>
        </div>

        {/* Loading Text */}
        <h2 
          className="text-lg font-medium mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Loading...
        </h2>
        <p 
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Please wait while we fetch your data
        </p>

        {/* Loading Dots */}
        <div className="mt-6 flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: 'var(--accent)',
                animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite both`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
