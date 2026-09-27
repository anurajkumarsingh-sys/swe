'use client'

import type { SummaryData } from '@/lib/content-engine'
import { Lightbulb } from 'lucide-react'

interface SummaryOverlayProps {
  summary: SummaryData
  onDismiss: () => void
}

export function SummaryOverlay({ summary, onDismiss }: SummaryOverlayProps) {
  return (
    <div className="overlay-backdrop absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[var(--surface-1)] border border-[var(--neon-amber)]/30 rounded-2xl p-6 shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)] relative overflow-hidden">
        {/* Animated glow background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--neon-amber)]/10 blur-[80px] rounded-full" />
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-[var(--neon-amber)]/20 flex items-center justify-center shrink-0 border border-[var(--neon-amber)]/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Lightbulb className="w-6 h-6 text-[var(--neon-amber)] animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
              Quick Help
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] font-medium">
              We noticed a moment of confusion. Here's a quick breakdown.
            </p>
          </div>
        </div>

        {/* Topic badge */}
        <div className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--neon-amber)]/10 border border-[var(--neon-amber)]/20 mb-5">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-amber)] animate-ping" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--neon-amber)]">
            Topic: {summary.topic}
          </span>
        </div>

        {/* Summary text */}
        <div className="relative z-10 p-5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] mb-6 group transition-all hover:border-[var(--neon-amber)]/30">
          <p className="text-sm text-[var(--foreground)] leading-relaxed font-medium">
            {summary.summary}
          </p>
        </div>

        {/* Action */}
        <button
          onClick={onDismiss}
          className="relative z-10 w-full py-4 rounded-xl bg-[var(--neon-green)] text-[var(--surface-0)] font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(34,197,94,0.3)] hover:shadow-[0_4px_25px_rgba(34,197,94,0.4)]"
        >
          I understand, continue lecture
        </button>
      </div>
    </div>
  )
}
