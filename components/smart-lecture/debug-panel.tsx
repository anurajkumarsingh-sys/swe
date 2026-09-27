'use client'

import React, { useState } from 'react'
import { VisionState } from '@/lib/vision-engine'
import { Activity, Target, Eye, AlertCircle, Settings2, BarChart, X } from 'lucide-react'

interface DebugPanelProps {
  visionState: VisionState
  currentTime: number
  baselineEAR: number
  baselineBrow: number
  baselineInterBrow?: number
}

export function DebugPanel({ visionState, currentTime, baselineEAR, baselineBrow, baselineInterBrow = 0 }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-4 right-4 z-50 p-3 rounded-full bg-[var(--surface-1)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--neon-blue)] transition-all shadow-xl"
        title="Open Debug Panel"
      >
        <Settings2 size={20} />
      </button>
    )
  }

  return (
    <div className="absolute bottom-4 right-4 z-50 w-80 bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-2)]">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[var(--neon-blue)]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">Vision Debug</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 max-h-[420px] overflow-y-auto font-mono text-[10px]">
        {/* State Section */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[var(--muted-foreground)] uppercase font-bold text-[9px] mb-1">
            <span>Engine State</span>
            <span className={visionState.emotion === 'focused' ? 'text-[var(--neon-green)]' : visionState.emotion === 'drowsy' ? 'text-[var(--neon-red)]' : 'text-[var(--neon-amber)]'}>
              {visionState.emotion}
            </span>
          </div>
          <DebugItem label="Attention" value={`${visionState.attention}%`} color={getAttentionColor(visionState.attention)} />
          <DebugItem label="Confusion Score" value={`${visionState.metrics.confusionScore}% (${visionState.metrics.confusionType})`} color={visionState.metrics.confusionScore > 35 ? 'var(--neon-amber)' : undefined} />
          <DebugItem label="Paused Reason" value={visionState.pausedReason || 'None'} />
          <DebugItem label="Video Time" value={`${currentTime.toFixed(2)}s`} />
        </div>

        <div className="h-px bg-[var(--border)]" />

        {/* Metrics Section */}
        <div className="space-y-1.5">
          <div className="text-[var(--muted-foreground)] uppercase font-bold text-[9px] mb-1">Live Metrics</div>
          <DebugMetric 
            label="EAR (Openness)" 
            value={visionState.metrics.ear.toFixed(3)} 
            baseline={baselineEAR.toFixed(3)}
            ratio={`${(visionState.metrics.earRatio * 100).toFixed(0)}%`}
            threshold="<65% Drowsy, <85% Squint"
          />
          <DebugMetric 
            label="Brow Height" 
            value={visionState.metrics.browRatio.toFixed(3)} 
            baseline={baselineBrow.toFixed(3)}
            ratio={`${visionState.metrics.browRatioChange >= 0 ? '+' : ''}${(visionState.metrics.browRatioChange * 100).toFixed(1)}%`}
            threshold="<-6% Furrow, >+9% Raise"
          />
          <DebugMetric 
            label="Inter-Brow (Knit)" 
            value={visionState.metrics.interBrowDist.toFixed(3)} 
            baseline={baselineInterBrow.toFixed(3)}
            ratio={`${visionState.metrics.interBrowChange >= 0 ? '+' : ''}${(visionState.metrics.interBrowChange * 100).toFixed(1)}%`}
            threshold="<-5% Knitted"
          />
          <DebugItem label="Gaze Offset" value={visionState.metrics.gazeOffCenter.toFixed(1)} />
        </div>

        <div className="h-px bg-[var(--border)]" />

        {/* Status Section */}
        <div className="space-y-1.5">
          <div className="text-[var(--muted-foreground)] uppercase font-bold text-[9px] mb-1">Hardware Status</div>
          <DebugStatus label="Face Detected" active={visionState.metrics.faceDetected} />
          <DebugStatus label="Calibrating" active={visionState.metrics.isCalibrating} />
          <div className="flex justify-between items-center">
            <span>Calibration</span>
            <span>{Math.round(visionState.metrics.calibrationProgress * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DebugItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span style={{ color: color || 'var(--foreground)' }} className="font-bold">{value}</span>
    </div>
  )
}

function DebugMetric({ label, value, baseline, ratio, threshold }: { label: string; value: string; baseline: string; ratio: string; threshold: string }) {
  return (
    <div className="bg-[var(--surface-2)] p-2 rounded-lg space-y-1">
      <div className="flex justify-between items-center font-bold">
        <span>{label}</span>
        <span className="text-[var(--foreground)]">{value}</span>
      </div>
      <div className="flex justify-between items-center text-[var(--muted-foreground)] text-[9px]">
        <span>Base: {baseline}</span>
        <span>Ratio: {ratio}x</span>
      </div>
      <div className="flex justify-between items-center text-[var(--muted-foreground)] text-[9px]">
        <span>Limit: {threshold}</span>
      </div>
    </div>
  )
}

function DebugStatus({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-[var(--neon-green)]' : 'bg-[var(--neon-red)]'}`} />
    </div>
  )
}

function CloseIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

function getAttentionColor(score: number): string {
  if (score > 80) return 'var(--neon-green)'
  if (score > 50) return 'var(--neon-amber)'
  return 'var(--neon-red)'
}
