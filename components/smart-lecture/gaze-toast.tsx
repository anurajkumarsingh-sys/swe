'use client'

import { useEffect, useState } from 'react'

interface GazeToastProps {
  isVisible: boolean
}

export function GazeToast({ isVisible }: GazeToastProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setShow(true)
    } else {
      const timer = setTimeout(() => setShow(false), 500)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  if (!show) return null

  return (
    <div
      className={`absolute top-4 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface-1)] border border-[var(--neon-blue)]/40 shadow-lg transition-all duration-500 ${
        isVisible
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-4'
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-[var(--neon-blue)]/20 flex items-center justify-center shrink-0">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-4 h-4 text-[var(--neon-blue)]"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Looking Away
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Please focus on the screen
        </p>
      </div>
    </div>
  )
}
