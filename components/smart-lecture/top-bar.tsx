'use client'

import { useState } from 'react'

interface TopBarProps {
  onLoadVideo: (url: string) => void
  isLoading: boolean
  statusText: string
  statusColor: 'green' | 'red' | 'amber' | 'blue' | 'gray'
  isTracking: boolean
}

export function TopBar({
  onLoadVideo,
  isLoading,
  statusText,
  statusColor,
  isTracking,
}: TopBarProps) {
  const [url, setUrl] = useState('')

  const colorMap = {
    green: 'bg-[var(--neon-green)] text-[var(--surface-0)]',
    red: 'bg-[var(--neon-red)] text-[var(--foreground)]',
    amber: 'bg-[var(--neon-amber)] text-[var(--surface-0)]',
    blue: 'bg-[var(--neon-blue)] text-[var(--foreground)]',
    gray: 'bg-[var(--surface-3)] text-[var(--muted-foreground)]',
  }

  const glowMap = {
    green: 'glow-green',
    red: 'glow-red',
    amber: 'glow-amber',
    blue: 'glow-blue',
    gray: '',
  }

  return (
    <header className="flex items-center gap-4 px-6 py-3 border-b border-[var(--border)] bg-[var(--surface-1)]">
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-7 w-7 text-[var(--neon-green)]"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
          <h1 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">
            Smart-Lecture <span className="text-[var(--neon-green)] font-mono text-sm">v4</span>
          </h1>
        </div>
      </div>

      <div className="flex-1 flex items-center gap-3 max-w-2xl">
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL here..."
            className="w-full px-4 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-green)]/50 focus:border-[var(--neon-green)]/50 font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && url.trim()) {
                onLoadVideo(url.trim())
              }
            }}
          />
        </div>
        <button
          onClick={() => url.trim() && onLoadVideo(url.trim())}
          disabled={isLoading || !url.trim()}
          className="px-5 py-2 rounded-lg bg-[var(--neon-green)] text-[var(--surface-0)] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isLoading ? 'Loading...' : 'Load'}
        </button>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${colorMap[statusColor]} ${glowMap[statusColor]} transition-all duration-300`}>
          <span
            className={`w-2 h-2 rounded-full ${
              isTracking ? 'animate-pulse-neon' : ''
            } ${
              statusColor === 'green' ? 'bg-[var(--surface-0)]' :
              statusColor === 'gray' ? 'bg-[var(--muted-foreground)]' :
              'bg-current'
            }`}
          />
          {statusText}
        </div>
      </div>
    </header>
  )
}
