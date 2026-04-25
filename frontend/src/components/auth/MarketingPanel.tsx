'use client'

import { ReactNode } from 'react'
import {
  ShieldCheck,
  Radar,
  SearchCheck,
  GitBranch,
  Lock,
} from 'lucide-react'

interface Feature {
  icon: ReactNode
  title: string
  body: string
}

const DEFAULT_FEATURES: Feature[] = [
  {
    icon: <Radar className="h-4 w-4" />,
    title: 'Broad detector coverage',
    body: 'Rules for popular cloud, payment, source-control, and identity providers — tuned to keep false positives low.',
  },
  {
    icon: <SearchCheck className="h-4 w-4" />,
    title: 'Entropy + validator engine',
    body: 'Catches unknown high-entropy secrets, rejects placeholders, and ranks every finding by exploit risk.',
  },
  {
    icon: <GitBranch className="h-4 w-4" />,
    title: 'Works across your stack',
    body: 'Integrate repositories, CI pipelines, container images, and cloud storage into one unified feed.',
  },
  {
    icon: <Lock className="h-4 w-4" />,
    title: 'Zero-retention by default',
    body: 'Code is scanned in memory and never persisted. SAML SSO and role-based access on Business plans.',
  },
]

interface MarketingPanelProps {
  heading?: ReactNode
  lead?: ReactNode
  features?: Feature[]
  badge?: string
}

export function MarketingPanel({
  heading = (
    <>
      Stop leaked secrets
      <br />
      before they hit production.
    </>
  ),
  lead = 'VaultSentry watches your repositories, CI jobs, and cloud artifacts for leaked credentials — so your team can ship fast without shipping keys.',
  features = DEFAULT_FEATURES,
  badge = 'Built for modern engineering teams',
}: MarketingPanelProps) {
  return (
    <div className="flex h-full flex-col justify-center gap-10 py-2 pl-2 pr-4">
      <div>
        {badge && (
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] font-medium"
            style={{
              borderColor: 'rgba(59, 130, 246, 0.25)',
              background: 'rgba(59, 130, 246, 0.08)',
              color: '#93c5fd',
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> {badge}
          </span>
        )}
        <h2
          className="mt-5 text-[32px] font-semibold leading-[1.15] tracking-tight"
          style={{ color: '#fafafa' }}
        >
          {heading}
        </h2>
        <p
          className="mt-4 max-w-[440px] text-[14px] leading-relaxed"
          style={{ color: '#a3a3a3' }}
        >
          {lead}
        </p>
      </div>

      <ul className="space-y-5">
        {features.map((f) => (
          <li key={f.title} className="group flex items-start gap-3.5">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
              style={{
                border: '1px solid rgba(82, 82, 82, 0.5)',
                background: '#171717',
                color: '#3b82f6',
              }}
            >
              {f.icon}
            </span>
            <div>
              <p className="text-[13.5px] font-medium" style={{ color: '#fafafa' }}>
                {f.title}
              </p>
              <p
                className="mt-1 text-[12.5px] leading-relaxed"
                style={{ color: '#a3a3a3' }}
              >
                {f.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default MarketingPanel
