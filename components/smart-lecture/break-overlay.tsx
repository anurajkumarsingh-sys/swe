'use client'

import { useState, useEffect } from 'react'
import { Coffee, Play, FastForward, Sparkles, Eye, Droplets, Wind } from 'lucide-react'

interface BreakOverlayProps {
  onSkip: () => void
  onTimerEnd: () => void
  durationSeconds?: number // default 120 (2 minutes)
}

export function BreakOverlay({
  onSkip,
  onTimerEnd,
  durationSeconds = 120,
}: BreakOverlayProps) {
  const [mode, setMode] = useState<'prompt' | 'timer'>('prompt')
  const [timeLeft, setTimeLeft] = useState(durationSeconds)
  const [tipIndex, setTipIndex] = useState(0)

  const tips = [
    { icon: <Eye className="w-4 h-4 text-[var(--neon-blue)]" />, text: 'Look 20 feet away to rest your eyes' },
    { icon: <Wind className="w-4 h-4 text-[var(--neon-green)]" />, text: 'Take 3 deep, slow breaths' },
    { icon: <Droplets className="w-4 h-4 text-[var(--neon-blue)]" />, text: 'Hydrate with a sip of water' },
    { icon: <Sparkles className="w-4 h-4 text-[var(--neon-amber)]" />, text: 'Roll your shoulders and stretch gently' },
  ]

  // Countdown timer logic
  useEffect(() => {
    if (mode !== 'timer') return

    if (timeLeft <= 0) {
      onTimerEnd()
      return
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onTimerEnd()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [mode, timeLeft, onTimerEnd])

  // Cycle wellness tips every 8 seconds during break
  useEffect(() => {
    if (mode !== 'timer') return
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length)
    }, 8000)
    return () => clearInterval(tipInterval)
  }, [mode, tips.length])

  // Formatting minutes:seconds
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  // Progress calculation for circular timer
  const progressPercent = ((durationSeconds - timeLeft) / durationSeconds) * 100
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference

  return (
    <div className="overlay-backdrop absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[var(--surface-1)] border border-[var(--neon-amber)]/30 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_-10px_rgba(245,158,11,0.25)] relative overflow-hidden">
        {/* Glow backdrop effects */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-[var(--neon-amber)]/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-[var(--neon-blue)]/10 blur-[80px] rounded-full pointer-events-none" />

        {mode === 'prompt' ? (
          /* Initial Choice Screen: Optional Break */
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--neon-amber)]/20 flex items-center justify-center border border-[var(--neon-amber)]/30 shadow-[0_0_20px_rgba(245,158,11,0.25)] mb-5">
              <Coffee className="w-8 h-8 text-[var(--neon-amber)] animate-pulse" />
            </div>

            <h3 className="text-2xl font-bold text-[var(--foreground)] tracking-tight mb-2">
              You look tired! Take a short break.
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-sm mb-6 leading-relaxed">
              Step away for a quick 2-minute breather to recharge your mind and maintain peak focus.
            </p>

            {/* Quick tips preview */}
            <div className="w-full grid grid-cols-2 gap-2.5 mb-7 text-left">
              {tips.map((tip, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)] text-xs text-[var(--foreground)]/80 font-medium"
                >
                  <div className="p-1 rounded-lg bg-[var(--surface-3)] shrink-0">
                    {tip.icon}
                  </div>
                  <span className="truncate">{tip.text}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setMode('timer')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--neon-amber)] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              >
                <Coffee className="w-4 h-4" />
                Take 2 Min Break
              </button>
              <button
                onClick={onSkip}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--surface-2)] text-[var(--foreground)] font-semibold text-sm hover:bg-[var(--surface-3)] active:scale-[0.98] transition-all border border-[var(--border)]"
              >
                <FastForward className="w-4 h-4 text-[var(--muted-foreground)]" />
                Skip Break
              </button>
            </div>
          </div>
        ) : (
          /* Active Countdown Timer Screen */
          <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in duration-300">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--neon-amber)]/10 border border-[var(--neon-amber)]/20 text-[11px] font-bold uppercase tracking-wider text-[var(--neon-amber)] mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Recharge in Progress
            </div>

            {/* Circular Visual Timer */}
            <div className="relative w-36 h-36 flex items-center justify-center mb-6">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 130 130">
                {/* Background Ring */}
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-[var(--surface-3)]"
                  fill="transparent"
                />
                {/* Animated Progress Ring */}
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-[var(--neon-amber)] transition-all duration-1000 ease-linear"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-mono font-bold text-[var(--foreground)] tracking-tight">
                  {formattedTime}
                </span>
                <span className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] tracking-widest mt-0.5">
                  Remaining
                </span>
              </div>
            </div>

            {/* Dynamic wellness reminder tip */}
            <div className="w-full p-3.5 rounded-xl bg-[var(--surface-2)]/80 border border-[var(--border)] flex items-center justify-center gap-2.5 mb-7 transition-all duration-500 min-h-[50px]">
              <div className="p-1.5 rounded-lg bg-[var(--surface-3)] shrink-0">
                {tips[tipIndex].icon}
              </div>
              <span className="text-xs text-[var(--foreground)] font-medium">
                {tips[tipIndex].text}
              </span>
            </div>

            {/* Early resume / end break option */}
            <button
              onClick={onTimerEnd}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--surface-2)] text-[var(--foreground)] font-semibold text-xs hover:bg-[var(--surface-3)] active:scale-[0.98] transition-all border border-[var(--border)]"
            >
              <Play className="w-3.5 h-3.5 text-[var(--neon-green)]" />
              End Break Early & Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
