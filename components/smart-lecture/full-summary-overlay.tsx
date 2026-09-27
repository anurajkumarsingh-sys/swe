'use client'

import type { FullSummaryData } from '@/lib/content-engine'
import { BookOpen, X, CheckCircle } from 'lucide-react'

interface FullSummaryOverlayProps {
  summary: FullSummaryData
  onDismiss: () => void
}

export function FullSummaryOverlay({
  summary,
  onDismiss,
}: FullSummaryOverlayProps) {
  return (
    <div className="overlay-backdrop absolute inset-0 z-50 flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--neon-blue)]/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-[var(--neon-blue)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                {summary.title}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Full lecture summary powered by AI
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overview */}
        <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] mb-5">
          <p className="text-sm text-[var(--foreground)] leading-relaxed">
            {summary.overview}
          </p>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-3 mb-5">
          {summary.sections.map((section, i) => (
            <div
              key={i}
              className="flex gap-3 p-3 rounded-lg bg-[var(--surface-0)] border border-[var(--border)]"
            >
              <div className="w-6 h-6 rounded-full bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[var(--neon-green)]">
                  {i + 1}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                  {section.heading}
                </h4>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  {section.content}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Key Takeaways */}
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
            Key Takeaways
          </h4>
          <div className="flex flex-col gap-2">
            {summary.keyTakeaways.map((takeaway, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--neon-green)] shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--foreground)] leading-relaxed">
                  {takeaway}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-xl bg-[var(--neon-green)] text-[var(--surface-0)] font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Close Summary
        </button>
      </div>
    </div>
  )
}
