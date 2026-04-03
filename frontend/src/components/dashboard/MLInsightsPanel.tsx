'use client'

import { useState } from 'react'
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Zap,
  Info,
  Calendar,
  Database
} from 'lucide-react'

interface MLModelInfo {
  model_type: 'xgboost' | 'random_forest' | 'ensemble'
  version: string
  trained_at?: string
  accuracy?: number
  precision?: number
  recall?: number
  f1_score?: number
  samples_trained?: number
  last_retrain?: string
}

interface FeatureImportance {
  feature: string
  importance: number
  description?: string
}

interface MLInsightsPanelProps {
  modelInfo?: MLModelInfo
  featureImportance?: FeatureImportance[]
  recentPredictions?: {
    total: number
    correct: number
    false_positives: number
    false_negatives: number
  }
  loading?: boolean
  onRetrain?: () => void
  onViewDetails?: () => void
}

const modelTypeLabels: Record<string, { label: string; color: string }> = {
  xgboost: { label: 'XGBoost', color: 'text-blue-400' },
  random_forest: { label: 'Random Forest', color: 'text-emerald-400' },
  ensemble: { label: 'Ensemble', color: 'text-purple-400' },
}

const featureDescriptions: Record<string, string> = {
  secret_type: 'Type of secret (API key, password, etc.)',
  entropy: 'Randomness measure of the secret value',
  file_path_risk: 'Risk based on file location',
  environment: 'Production, staging, development',
  repo_criticality: 'Business criticality of repository',
  exposure_history: 'Previous exposures in similar contexts',
  rotation_age: 'Days since last rotation',
  access_frequency: 'How often the secret is accessed',
}

export default function MLInsightsPanel({
  modelInfo,
  featureImportance,
  recentPredictions,
  loading,
  onRetrain,
  onViewDetails
}: MLInsightsPanelProps) {
  const [showAllFeatures, setShowAllFeatures] = useState(false)

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 skeleton rounded-xl" />
          <div className="flex-1">
            <div className="h-4 w-32 skeleton mb-1" />
            <div className="h-3 w-20 skeleton" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const displayedFeatures = showAllFeatures 
    ? featureImportance 
    : featureImportance?.slice(0, 5)

  const modelType = modelInfo?.model_type 
    ? modelTypeLabels[modelInfo.model_type] 
    : null

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">ML Risk Scoring</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {modelType ? modelType.label : 'Ensemble'} model
              {modelInfo?.version && ` v${modelInfo.version}`}
            </p>
          </div>
        </div>
        {onRetrain && (
          <button
            onClick={onRetrain}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retrain
          </button>
        )}
      </div>

      {/* Model Metrics */}
      {modelInfo && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-emerald-400">
              {modelInfo.accuracy !== undefined ? `${(modelInfo.accuracy * 100).toFixed(1)}%` : '-'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Accuracy</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-400">
              {modelInfo.precision !== undefined ? `${(modelInfo.precision * 100).toFixed(1)}%` : '-'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Precision</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-amber-400">
              {modelInfo.recall !== undefined ? `${(modelInfo.recall * 100).toFixed(1)}%` : '-'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Recall</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-purple-400">
              {modelInfo.f1_score !== undefined ? `${(modelInfo.f1_score * 100).toFixed(1)}%` : '-'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">F1 Score</p>
          </div>
        </div>
      )}

      {/* Recent Predictions Summary */}
      {recentPredictions && (
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">Recent Predictions (7d)</span>
            <span className="text-xs text-[var(--text-primary)]">
              {recentPredictions.total} total
            </span>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm text-[var(--text-secondary)]">
                {recentPredictions.correct} correct
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm text-[var(--text-secondary)]">
                {recentPredictions.false_positives} FP
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-sm text-[var(--text-secondary)]">
                {recentPredictions.false_negatives} FN
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Feature Importance */}
      {featureImportance && featureImportance.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Feature Importance
            </h4>
            {featureImportance.length > 5 && (
              <button
                onClick={() => setShowAllFeatures(!showAllFeatures)}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {showAllFeatures ? 'Show Less' : `Show All (${featureImportance.length})`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {displayedFeatures?.map((feature, index) => (
              <div key={feature.feature} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {feature.feature.replace(/_/g, ' ')}
                    </span>
                    {featureDescriptions[feature.feature] && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <span title={featureDescriptions[feature.feature]}>
                          <Info className="w-3 h-3 text-[var(--text-muted)]" />
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {(feature.importance * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${feature.importance * 100}%`,
                      backgroundColor: index === 0 ? 'var(--accent)' : 
                        index === 1 ? '#8b5cf6' :
                        index === 2 ? '#06b6d4' : 
                        index === 3 ? '#f59e0b' : '#6b7280'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Training Info */}
      {modelInfo && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-4">
            {modelInfo.samples_trained && (
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                {modelInfo.samples_trained.toLocaleString()} samples
              </span>
            )}
            {modelInfo.last_retrain && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Last trained: {new Date(modelInfo.last_retrain).toLocaleDateString()}
              </span>
            )}
          </div>
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              View Details
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
