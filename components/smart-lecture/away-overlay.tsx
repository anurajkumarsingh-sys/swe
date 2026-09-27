'use client'

import { EyeOff, Play } from 'lucide-react'

interface AwayOverlayProps {
  onResume: () => void
}

export function AwayOverlay({ onResume }: AwayOverlayProps) {
  return (
    <div className="overlay-backdrop absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[var(--surface-1)] border border-[var(--neon-blue)]/30 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_-10px_rgba(59,130,246,0.25)] relative overflow-hidden text-center">
        {/* Glow background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--neon-blue)]/15 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[var(--neon-purple)]/10 blur-[80px] rounded-full pointer-events-none" />

        {/* Icon */}
        <div className="relative z-10 w-14 h-14 rounded-2xl bg-[var(--neon-blue)]/20 text-[var(--neon-blue)] flex items-center justify-center mx-auto mb-4 border border-[var(--neon-blue)]/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <EyeOff className="w-7 h-7 animate-pulse" />
        </div>

        {/* Text */}
        <h3 className="relative z-10 text-xl font-bold text-[var(--foreground)] tracking-tight mb-2">
          Video paused because you were away.
        </h3>
        <p className="relative z-10 text-xs md:text-sm text-[var(--muted-foreground)] max-w-xs mx-auto mb-6 leading-relaxed">
          We noticed you were away from the screen for 15 seconds. Your progress has been kept safe.
        </p>

        {/* Resume Button */}
        <button
          onClick={onResume}
          className="relative z-10 w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[var(--neon-green)] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          Resume Video
        </button>
      </div>
    </div>
  )
}
