'use client'

import MLInsightsPanel from '@/components/dashboard/MLInsightsPanel'
import SecretLifecycle from '@/components/dashboard/SecretLifecycle'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Brain } from 'lucide-react'
import { useState } from 'react'

const DEFAULT_MODEL = {
  model_type: 'ensemble' as const,
  version: '1.0.0',
  trained_at: new Date().toISOString(),
  accuracy: 0,
  precision: 0,
  recall: 0,
  f1_score: 0,
  samples_trained: 0,
  last_retrain: new Date().toISOString(),
}

const DEFAULT_LIFECYCLE = {
  detected: 0,
  revoked: 0,
  rotated: 0,
  verified: 0,
}

const DEFAULT_LIFECYCLE_METRICS = {
  mttr_hours: 0,
  mttr_trend: 'stable' as const,
  sla_compliance_rate: 0,
  sla_breaches: 0,
  auto_rotated_count: 0,
  manual_resolved_count: 0,
  false_positive_count: 0,
  avg_age_days: 0,
  oldest_open_days: 0,
  by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
}

export default function InsightsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { isAuthenticated } = useAuth()
  const toast = useToast()

  if (!isAuthenticated) return null

  return (
    <div className="fixed inset-0 flex overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{ background: 'var(--bg-primary)' }}
        >
          <div className="max-w-[1400px] mx-auto px-6 pt-5 pb-8 space-y-6">
            <header className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  Model insights
                </h1>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  How the ML scoring model is performing and where remediation is bottlenecked.
                </p>
              </div>
            </header>

            <section className="dashboard-card">
              <SecretLifecycle
                stats={DEFAULT_LIFECYCLE}
                metrics={DEFAULT_LIFECYCLE_METRICS}
                loading={false}
              />
            </section>

            <section className="dashboard-card">
              <MLInsightsPanel
                modelInfo={DEFAULT_MODEL}
                featureImportance={[]}
                recentPredictions={{ total: 0, correct: 0, false_positives: 0, false_negatives: 0 }}
                loading={false}
                onRetrain={() => toast.info('Model retraining initiated...')}
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
