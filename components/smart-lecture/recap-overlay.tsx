'use client'

import { useState, useEffect } from 'react'
import { BookmarkCheck, Play, Loader2, Sparkles, CheckCircle2 } from 'lucide-react'
import type { RecapData, TranscriptEntry } from '@/lib/content-engine'
import { generateRecap } from '@/lib/content-engine'

interface RecapOverlayProps {
  recap?: RecapData | null
  transcript?: TranscriptEntry[]
  currentTime?: number
  videoLanguage?: string
  onAcknowledge: () => void
}

export function RecapOverlay({
  recap: initialRecap,
  transcript = [],
  currentTime = 0,
  videoLanguage = 'en',
  onAcknowledge,
}: RecapOverlayProps) {
  const [recapData, setRecapData] = useState<RecapData | null>(initialRecap || null)
  const [loading, setLoading] = useState(!initialRecap)

  useEffect(() => {
    if (initialRecap) {
      setRecapData(initialRecap)
      setLoading(false)
      return
    }

    let isMounted = true

    async function fetchRecap() {
      setLoading(true)
      try {
        const data = await generateRecap(transcript, currentTime, videoLanguage)
        if (isMounted) {
          setRecapData(data)
        }
      } catch (err) {
        console.error('Failed to generate recap:', err)
        if (isMounted) {
          setRecapData({
            topic: 'Lecture Catch-up & Context',
            bullets: [
              'The instructor was discussing the key concepts right before your break.',
              'Essential principles were established with practical examples on screen.',
              'You are all set to resume the lecture right where you left off.',
            ],
          })
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchRecap()

    return () => {
      isMounted = false
    }
  }, [initialRecap, transcript, currentTime, videoLanguage])

  return (
    <div className="overlay-backdrop absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[var(--surface-1)] border border-[var(--neon-blue)]/30 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_-10px_rgba(59,130,246,0.3)] relative overflow-hidden">
        {/* Glow backdrop effects */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-[var(--neon-blue)]/15 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-[var(--neon-green)]/10 blur-[80px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-center gap-4 mb-5 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-[var(--neon-blue)]/20 flex items-center justify-center shrink-0 border border-[var(--neon-blue)]/30 shadow-[0_0_15px_rgba(59,130,246,0.25)]">
            <BookmarkCheck className="w-6 h-6 text-[var(--neon-blue)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                Welcome Back!
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-[var(--neon-blue)]/10 border border-[var(--neon-blue)]/20 text-[10px] font-bold text-[var(--neon-blue)] uppercase tracking-wider">
                Post-Break Recap
              </span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] font-medium mt-0.5">
              Here is a quick refresher of the last 2-3 minutes before your break.
            </p>
          </div>
        </div>

        {/* Topic Badge */}
        {recapData?.topic && (
          <div className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] mb-5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--neon-amber)]" />
            <span className="text-[11px] font-semibold text-[var(--foreground)]">
              Topic: <span className="text-[var(--neon-blue)]">{recapData.topic}</span>
            </span>
          </div>
        )}

        {/* Content: 3 Recap Bullets or Skeleton Loader */}
        <div className="relative z-10 mb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)] min-h-[160px]">
              <Loader2 className="w-8 h-8 text-[var(--neon-blue)] animate-spin mb-3" />
              <p className="text-xs text-[var(--muted-foreground)] font-medium">
                Generating your post-break refresher...
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {recapData?.bullets?.map((bullet, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--surface-2)]/80 border border-[var(--border)] hover:border-[var(--neon-blue)]/30 transition-all text-left"
                >
                  <div className="w-5 h-5 rounded-full bg-[var(--neon-blue)]/20 text-[var(--neon-blue)] flex items-center justify-center shrink-0 mt-0.5 border border-[var(--neon-blue)]/30 text-[11px] font-bold">
                    {idx + 1}
                  </div>
                  <p className="text-xs md:text-sm text-[var(--foreground)] leading-relaxed font-medium">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button: Acknowledge & Continue */}
        <button
          onClick={onAcknowledge}
          disabled={loading}
          className="relative z-10 w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[var(--neon-green)] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          Acknowledge & Continue
        </button>
      </div>
    </div>
  )
}
