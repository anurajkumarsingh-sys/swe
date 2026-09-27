'use client'

interface SimulateButtonsProps {
  onSimulate: (emotion: 'confused' | 'drowsy' | 'away') => void
  disabled: boolean
}

export function SimulateButtons({ onSimulate, disabled }: SimulateButtonsProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
        Simulate States
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onSimulate('confused')}
          disabled={disabled}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--neon-amber)]/10 border border-[var(--neon-amber)]/30 text-[var(--neon-amber)] text-xs font-semibold hover:bg-[var(--neon-amber)]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confused
        </button>
        <button
          onClick={() => onSimulate('drowsy')}
          disabled={disabled}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--neon-red)]/10 border border-[var(--neon-red)]/30 text-[var(--neon-red)] text-xs font-semibold hover:bg-[var(--neon-red)]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Drowsy
        </button>
        <button
          onClick={() => onSimulate('away')}
          disabled={disabled}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--neon-blue)]/10 border border-[var(--neon-blue)]/30 text-[var(--neon-blue)] text-xs font-semibold hover:bg-[var(--neon-blue)]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Away
        </button>
      </div>
    </div>
  )
}
