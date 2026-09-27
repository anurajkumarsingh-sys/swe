'use client'

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react'
import type { TranscriptEntry } from '@/lib/content-engine'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from 'lucide-react'

export interface VideoPlayerHandle {
  play: () => void
  pause: () => void
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (time: number) => void
  getCurrentTime: () => number
  loadVideo: (url: string) => void
}

interface VideoPlayerProps {
  videoId: string | null
  isPaused: boolean
  onTimeUpdate: (time: number) => void
  transcript: TranscriptEntry[]
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

type PlayerType = 'youtube' | 'native' | 'vimeo' | null

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ videoId, isPaused, onTimeUpdate, transcript, isFullscreen = false, onToggleFullscreen }: VideoPlayerProps, ref: React.Ref<VideoPlayerHandle>) {
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [playerReady, setPlayerReady] = useState(false)
    const [playerType, setPlayerType] = useState<PlayerType>(null)
    const [sourceUrl, setSourceUrl] = useState<string | null>(null)
    
    const ytPlayerRef = useRef<YT.Player | null>(null)
    const nativePlayerRef = useRef<HTMLVideoElement>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const handlePlay = () => {
      if (playerType === 'youtube') ytPlayerRef.current?.playVideo()
      else if (playerType === 'native') nativePlayerRef.current?.play().catch(() => {})
    }

    const handlePause = () => {
      if (playerType === 'youtube') ytPlayerRef.current?.pauseVideo()
      else if (playerType === 'native') nativePlayerRef.current?.pause()
    }

    // Expose player methods via ref
    useImperativeHandle(ref, () => ({
      play: handlePlay,
      playVideo: handlePlay,
      pause: handlePause,
      pauseVideo: handlePause,
      seekTo: (time: number) => {
        if (playerType === 'youtube') ytPlayerRef.current?.seekTo(time, true)
        else if (playerType === 'native' && nativePlayerRef.current) nativePlayerRef.current.currentTime = time
      },
      getCurrentTime: () => {
        if (playerType === 'youtube') return ytPlayerRef.current?.getCurrentTime() ?? 0
        if (playerType === 'native') return nativePlayerRef.current?.currentTime ?? 0
        return 0
      },
      loadVideo: (url: string) => {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          setPlayerType('youtube')
          setSourceUrl(url)
        } else {
          setPlayerType('native')
          setSourceUrl(url)
        }
      }
    }))

    // Detect player type from videoId or sourceUrl
    useEffect(() => {
      if (videoId) {
        setPlayerType('youtube')
      }
    }, [videoId])

    // Load YouTube IFrame API
    useEffect(() => {
      if (typeof window === 'undefined') return

      if (!window.YT) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        const firstScriptTag = document.getElementsByTagName('script')[0]
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
      }

      window.onYouTubeIframeAPIReady = () => setPlayerReady(true)

      if (window.YT?.Player) setPlayerReady(true)
    }, [])

    // Initialize player when videoId changes
    useEffect(() => {
      if (playerType !== 'youtube' || !videoId || !playerReady) return

      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }

      ytPlayerRef.current = new window.YT.Player('yt-player', {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0, // We build our own controls
          modestbranding: 1,
          rel: 0,
          cc_load_policy: 1,
          disablekb: 1,
        },
        events: {
          onReady: (event: any) => {
            setDuration(event.target.getDuration())
          },
          onStateChange: (event: any) => {
            setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
          },
        },
      })
    }, [videoId, playerReady, playerType])

    // Pause based on external intervention state (quiz / summary overlay)
    useEffect(() => {
      if (!isPaused) return

      if (playerType === 'youtube' && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.pauseVideo()
        } catch {}
      } else if (playerType === 'native' && nativePlayerRef.current) {
        try {
          nativePlayerRef.current.pause()
        } catch {}
      }
    }, [isPaused, playerType])

    // Poll current time
    useEffect(() => {
      intervalRef.current = setInterval(() => {
        if (playerType === 'youtube' && ytPlayerRef.current?.getCurrentTime) {
          try {
            const time = ytPlayerRef.current.getCurrentTime()
            setCurrentTime(time)
            onTimeUpdate(time)
            const dur = ytPlayerRef.current.getDuration()
            if (dur > 0) setDuration(dur)
          } catch {}
        } else if (playerType === 'native' && nativePlayerRef.current) {
          const time = nativePlayerRef.current.currentTime
          setCurrentTime(time)
          onTimeUpdate(time)
          const dur = nativePlayerRef.current.duration
          if (dur > 0) setDuration(dur)
        }
      }, 200)

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, [onTimeUpdate, playerType])

    // Player control handlers
    const handlePlayPause = useCallback(() => {
      if (isPaused) return
      
      if (playerType === 'youtube' && ytPlayerRef.current) {
        if (isPlaying) ytPlayerRef.current.pauseVideo()
        else ytPlayerRef.current.playVideo()
      } else if (playerType === 'native' && nativePlayerRef.current) {
        if (isPlaying) nativePlayerRef.current.pause()
        else nativePlayerRef.current.play().catch(() => {})
      }
    }, [isPlaying, isPaused, playerType])

    const handleSkipBack = useCallback(() => {
      if (isPaused) return
      const newTime = Math.max(0, currentTime - 10)
      
      if (playerType === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(newTime, true)
      } else if (playerType === 'native' && nativePlayerRef.current) {
        nativePlayerRef.current.currentTime = newTime
      }
    }, [currentTime, isPaused, playerType])

    const handleSkipForward = useCallback(() => {
      if (isPaused) return
      const newTime = Math.min(duration, currentTime + 10)
      
      if (playerType === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(newTime, true)
      } else if (playerType === 'native' && nativePlayerRef.current) {
        nativePlayerRef.current.currentTime = newTime
      }
    }, [currentTime, duration, isPaused, playerType])

    const handleSeek = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isPaused) return
        const newTime = parseFloat(e.target.value)
        
        if (playerType === 'youtube' && ytPlayerRef.current) {
          ytPlayerRef.current.seekTo(newTime, true)
        } else if (playerType === 'native' && nativePlayerRef.current) {
          nativePlayerRef.current.currentTime = newTime
        }
        setCurrentTime(newTime)
      },
      [isPaused, playerType]
    )

    const handleMuteToggle = useCallback(() => {
      if (playerType === 'youtube' && ytPlayerRef.current) {
        if (isMuted) ytPlayerRef.current.unMute()
        else ytPlayerRef.current.mute()
      } else if (playerType === 'native' && nativePlayerRef.current) {
        nativePlayerRef.current.muted = !isMuted
      }
      setIsMuted(!isMuted)
    }, [isMuted, playerType])

    const handleFullscreen = useCallback(() => {
      if (onToggleFullscreen) {
        onToggleFullscreen()
      }
    }, [onToggleFullscreen])

    // ── Keyboard shortcuts: Space = play/pause, F = fullscreen ──────────
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Skip if user is typing in an input, textarea, or contentEditable
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
          return
        }

        if (e.code === 'Space') {
          e.preventDefault() // prevent page scroll
          handlePlayPause()
        }

        if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          handleFullscreen()
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handlePlayPause, handleFullscreen])

    // ── Recover focus when YouTube iframe steals it ─────────────────────
    useEffect(() => {
      const onBlur = () => {
        // If the active element is an iframe (YouTube player), pull focus back
        // after a short delay so the keydown listener on window keeps working
        setTimeout(() => {
          if (document.activeElement?.tagName?.toLowerCase() === 'iframe') {
            window.focus()
          }
        }, 0)
      }
      window.addEventListener('blur', onBlur)
      return () => window.removeEventListener('blur', onBlur)
    }, [])

    // Get current transcript text for caption bar
    const getCurrentTranscriptText = useCallback(() => {
      if (!transcript || !transcript.length) return ''
      const entry = transcript.find(
        (t: TranscriptEntry) => currentTime >= t.start && currentTime < t.start + t.duration
      )
      return entry?.text || ''
    }, [currentTime, transcript])

    const formatTime = (s: number): string => {
      const m = Math.floor(s / 60)
      const sec = Math.floor(s % 60)
      return `${m}:${sec.toString().padStart(2, '0')}`
    }

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
      <div className="flex flex-col gap-3 h-full">
        <div
          ref={containerRef}
          className="relative flex-1 bg-[var(--surface-0)] rounded-xl overflow-hidden border border-[var(--border)]"
        >
          {!playerType ? (
            <div className="flex items-center justify-center h-full min-h-[360px]">
              <div className="text-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-16 w-16 text-[var(--surface-3)] mx-auto mb-4"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
                <p className="text-[var(--muted-foreground)] text-sm">
                  Paste a Video URL above to start learning
                </p>
                <p className="text-[var(--surface-3)] text-xs mt-1">
                  Supports YouTube and direct video links
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full min-h-[360px]">
              {playerType === 'youtube' ? (
                <div id="yt-player" className="w-full h-full" />
              ) : (
                <video
                  ref={nativePlayerRef}
                  src={sourceUrl || ''}
                  className="w-full h-full"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  autoPlay
                />
              )}
            </div>
          )}

          {/* Custom Controls Bar */}
          {videoId && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--surface-0)]/95 to-transparent pt-8 pb-3 px-4">
              {/* Seek bar */}
              <div className="relative group mb-2">
                <div className="h-1 w-full bg-[var(--surface-3)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--neon-green)] rounded-full transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-1 opacity-0 cursor-pointer"
                  disabled={isPaused}
                />
              </div>

              {/* Buttons row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSkipBack}
                    disabled={isPaused}
                    className="p-1.5 rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
                    title="Skip back 10s"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    disabled={isPaused}
                    className="p-2 rounded-lg bg-[var(--foreground)] text-[var(--surface-0)] hover:opacity-90 transition-opacity disabled:opacity-40"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleSkipForward}
                    disabled={isPaused}
                    className="p-1.5 rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
                    title="Skip forward 10s"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-[var(--muted-foreground)] ml-1">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMuteToggle}
                    className="p-1.5 rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleFullscreen}
                    className="p-1.5 rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
                    title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                  >
                    {isFullscreen ? (
                      <Minimize className="w-4 h-4" />
                    ) : (
                      <Maximize className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Current caption bar */}
        {videoId && (
          <div className="px-4 py-2 bg-[var(--surface-1)] rounded-lg border border-[var(--border)] min-h-[40px]">
            <p className="text-sm text-[var(--foreground)] font-mono leading-relaxed">
              {getCurrentTranscriptText() || (
                <span className="text-[var(--muted-foreground)] italic">
                  Waiting for captions...
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    )
  }
)

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string
          playerVars?: Record<string, number | string>
          events?: Record<string, (event: YT.OnStateChangeEvent | YT.PlayerEvent) => void>
        }
      ) => YT.Player
      PlayerState: {
        PLAYING: number
        PAUSED: number
        ENDED: number
      }
    }
    onYouTubeIframeAPIReady: (() => void) | undefined
  }
}

declare namespace YT {
  interface Player {
    playVideo(): void
    pauseVideo(): void
    getCurrentTime(): number
    getDuration(): number
    seekTo(seconds: number, allowSeekAhead: boolean): void
    mute(): void
    unMute(): void
    destroy(): void
  }
  interface OnStateChangeEvent {
    data: number
  }
  interface PlayerEvent {
    target: Player
  }
}
