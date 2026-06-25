export default function VaultSentryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#0B0F14', color: '#E2E8F0' }}>
      {children}
    </div>
  )
}
