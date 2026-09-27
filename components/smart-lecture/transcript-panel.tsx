'use client'

import { useEffect, useRef } from 'react'
import type { TranscriptEntry } from '@/lib/content-engine'

interface TranscriptPanelProps {
  transcript: TranscriptEntry[]
  currentTime: number
}

export function TranscriptPanel({ transcript, currentTime }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active transcript entry
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current
      const element = activeRef.current
      
      const containerRect = container.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      
      // Only scroll if the element is not clearly visible
      const isVisible = (
        elementRect.top >= containerRect.top &&
        elementRect.bottom <= containerRect.bottom
      )

      if (!isVisible) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
    }
  }, [currentTime])

  if (!transcript.length) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-xs">
        No transcript loaded
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-1 overflow-y-auto max-h-[200px] pr-1"
    >
      {transcript.map((entry, index) => {
        const isActive =
          currentTime >= entry.start &&
          currentTime < entry.start + entry.duration
        const isPast = currentTime >= entry.start + entry.duration

        return (
          <div
            key={index}
            ref={isActive ? activeRef : null}
            className={`flex gap-2 px-2 py-1 rounded text-xs transition-all duration-200 ${
              isActive
                ? 'bg-[var(--neon-green)]/10 border-l-2 border-[var(--neon-green)]'
                : isPast
                ? 'opacity-50'
                : 'opacity-70'
            }`}
          >
            <span className="text-[var(--muted-foreground)] font-mono shrink-0 w-10">
              {formatTime(entry.start)}
            </span>
            <span
              className={`leading-relaxed ${
                isActive
                  ? 'text-[var(--foreground)] font-medium'
                  : 'text-[var(--muted-foreground)]'
              }`}
            >
              {entry.text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
