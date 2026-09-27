'use client'

import type { ConfusionType } from '@/lib/vision-engine'

interface MetricBarsProps {
  ear: number
  earRatio: number
  browRatioChange: number
  interBrowChange?: number
  confusionScore?: number
  confusionType?: ConfusionType
  gazeOffCenter: number
  attention: number
  isCalibrating: boolean
  calibrationProgress: number
  faceDetected: boolean
}

export function MetricBars({
  ear,
  earRatio,
  browRatioChange,
  interBrowChange = 0,
  confusionScore = 0,
  confusionType = 'none',
  gazeOffCenter,
  attention,
  isCalibrating,
  calibrationProgress,
  faceDetected,
}: MetricBarsProps) {
  const earPercent = Math.min(100, Math.max(0, earRatio * 100))
  const browPercent = Math.min(100, Math.max(0, 50 + browRatioChange * 250)) // 50% is baseline, <50% furrow, >50% raise
  const interBrowPercent = Math.min(100, Math.max(0, 50 + interBrowChange * 250)) // <50% knit together
  const gazePercent = Math.min(100, Math.max(0, gazeOffCenter * 4))

  const getEarColor = () => {
    if (earPercent < 65) return 'var(--neon-red)' // Drowsy
    if (earPercent < 85) return 'var(--neon-amber)' // Squinting
    return 'var(--neon-green)' // Normal
  }

  const getBrowColor = () => {
    if (browRatioChange < -0.06) return 'var(--neon-amber)' // Furrowed (Confused)
    if (browRatioChange > 0.09) return 'var(--neon-blue)' // Raised
    return 'var(--neon-green)'
  }

  const getInterBrowColor = () => {
    if (interBrowChange < -0.05) return 'var(--neon-amber)' // Knitted (Confused)
    return 'var(--neon-green)'
  }

  const getConfusionColor = () => {
    if (confusionScore >= 60) return 'var(--neon-red)'
    if (confusionScore >= 35) return 'var(--neon-amber)'
    if (confusionScore >= 20) return 'var(--neon-blue)'
    return 'var(--surface-3)'
  }

  const getGazeColor = () => {
    if (gazePercent > 60) return 'var(--neon-red)'
    if (gazePercent > 35) return 'var(--neon-amber)'
    return 'var(--neon-green)'
  }

  const getAttentionColor = () => {
    if (attention < 30) return 'var(--neon-red)'
    if (attention < 60) return 'var(--neon-amber)'
    return 'var(--neon-green)'
  }

  const getConfusionLabel = () => {
    switch (confusionType) {
      case 'squint':
        return 'Eyes Squinting'
      case 'furrow':
        return 'Brows Furrowed'
      case 'knit':
        return 'Brows Knitted'
      case 'raise':
        return 'Brows Raised'
      case 'combined':
        return 'High Confusion'
      default:
        return 'None'
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Attention Score - Circular */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
          Attention Score
        </span>
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={getAttentionColor()}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(attention / 100) * 263.89} 263.89`}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-xl font-bold font-mono transition-colors duration-300"
              style={{ color: getAttentionColor() }}
            >
              {attention}%
            </span>
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
        <div
          className={`w-2 h-2 rounded-full ${
            faceDetected ? 'bg-[var(--neon-green)] animate-pulse-neon' : 'bg-[var(--neon-red)]'
          }`}
        />
        <span className="text-xs text-[var(--muted-foreground)]">
          {isCalibrating
            ? `Calibrating... ${Math.round(calibrationProgress * 100)}%`
            : faceDetected
            ? 'Face Detected'
            : 'No Face Detected'}
        </span>
      </div>

      {/* Calibration progress */}
      {isCalibrating && (
        <div className="flex flex-col gap-1">
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--neon-blue)] rounded-full transition-all duration-200"
              style={{ width: `${calibrationProgress * 100}%` }}
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)] text-center">
            Look at the camera for 3 seconds
          </p>
        </div>
      )}

      {/* Metric bars */}
      <div className="flex flex-col gap-3">
        {/* Confusion Level Gauge */}
        <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getConfusionColor() }}
              />
              Confusion Intensity
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: getConfusionColor() }}>
              {confusionScore}%
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${confusionScore}%`,
                backgroundColor: getConfusionColor(),
              }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-[var(--muted-foreground)] pt-0.5">
            <span>Cue:</span>
            <span className="font-semibold text-[var(--foreground)]">{getConfusionLabel()}</span>
          </div>
        </div>

        {/* EAR (Eye Openness & Squint) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              Eye Openness (EAR)
            </span>
            <span className="text-xs font-mono" style={{ color: getEarColor() }}>
              {ear.toFixed(3)} ({Math.round(earRatio * 100)}%)
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${earPercent}%`,
                backgroundColor: getEarColor(),
              }}
            />
          </div>
        </div>

        {/* Brow Elevation (Furrow vs Raise) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              Brow Elevation
            </span>
            <span className="text-xs font-mono" style={{ color: getBrowColor() }}>
              {browRatioChange >= 0 ? '+' : ''}{(browRatioChange * 100).toFixed(1)}%
              {browRatioChange < -0.06 ? ' (Furrow)' : browRatioChange > 0.09 ? ' (Raised)' : ''}
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${browPercent}%`,
                backgroundColor: getBrowColor(),
              }}
            />
          </div>
        </div>

        {/* Inter-Brow Distance (Knitting) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              Brow Knit (Corrugator)
            </span>
            <span className="text-xs font-mono" style={{ color: getInterBrowColor() }}>
              {interBrowChange >= 0 ? '+' : ''}{(interBrowChange * 100).toFixed(1)}%
              {interBrowChange < -0.05 ? ' (Knitted)' : ''}
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${interBrowPercent}%`,
                backgroundColor: getInterBrowColor(),
              }}
            />
          </div>
        </div>

        {/* Gaze */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              Gaze Offset
            </span>
            <span className="text-xs font-mono" style={{ color: getGazeColor() }}>
              {gazeOffCenter.toFixed(1)}
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${gazePercent}%`,
                backgroundColor: getGazeColor(),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

