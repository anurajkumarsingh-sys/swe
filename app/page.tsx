'use client'

import { 
  GazeToast, 
  DebugPanel, 
  TopBar, 
  VideoPlayer, 
  MetricBars, 
  TranscriptPanel, 
  QuizOverlay, 
  BreakOverlay,
  RecapOverlay,
  AwayOverlay,
  SummaryOverlay, 
  FullSummaryOverlay, 
  SimulateButtons, 
  AnalyticsDashboard 
} from '@/components/smart-lecture'
import { useState, useCallback, useRef, useEffect } from 'react'
import { BookOpen, Loader2, LayoutDashboard, Video as VideoIcon } from 'lucide-react'
import { VisionEngine } from '@/lib/vision-engine'
import type { VisionState } from '@/lib/vision-engine'
import type {
  TranscriptEntry,
  QuizData,
  SummaryData,
  FullSummaryData,
} from '@/lib/content-engine'
import {
  extractVideoId,
  generateQuiz,
  generateSummary,
  generateFullSummary,
} from '@/lib/content-engine'
import { useMediaPipe } from '@/hooks/use-mediapipe'
import type { VideoPlayerHandle } from '@/components/smart-lecture/video-player'
import { saveSession, saveQuizResult } from '@/lib/analytics'
import type { SessionAnalytics } from '@/lib/analytics'

export default function SmartLecturePage() {
  // Video state
  const [videoId, setVideoId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [videoLanguage, setVideoLanguage] = useState<string>('en')
  const [isLoadingVideo, setIsLoadingVideo] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  // Vision state
  const [visionState, setVisionState] = useState<VisionState>({
    emotion: 'calibrating',
    attention: 100,
    metrics: {
      ear: 0,
      earRatio: 1,
      browRatio: 0,
      browRatioChange: 0,
      interBrowDist: 0,
      interBrowChange: 0,
      confusionScore: 0,
      confusionType: 'none',
      gazeOffCenter: 0,
      isCalibrating: true,
      calibrationProgress: 0,
      faceDetected: false,
    },
    pausedReason: null,
    lastConfusedTime: 0,
    lastDrowsyTime: 0,
    lastAwayTime: 0,
    awayStartTime: null,
    confusedStartTime: null,
    drowsyStartTime: null,
  })

  // Overlay state
  const [quizData, setQuizData] = useState<QuizData | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [fullSummaryData, setFullSummaryData] = useState<FullSummaryData | null>(null)
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [isRecapActive, setIsRecapActive] = useState(false)
  const [isAwayActive, setIsAwayActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [activeTab, setActiveTab] = useState<'player' | 'analytics'>('player')

  // Refs
  const engineRef = useRef<VisionEngine | null>(null)
  const currentTimeRef = useRef(0)
  const playerRef = useRef<VideoPlayerHandle>(null)
  const fullscreenContainerRef = useRef<HTMLDivElement>(null)

  // Analytics state
  const [session, setSession] = useState<SessionAnalytics | null>(null)
  const lastLoggedTimeRef = useRef<number>(0)

  // Initialize session when video changes
  useEffect(() => {
    if (videoId) {
      const newSession: SessionAnalytics = {
        sessionId: Math.random().toString(36).substring(7),
        startTime: Date.now(),
        videoId: videoId,
        videoTitle: `Video: ${videoId}`,
        emotionTimeline: [],
        events: [],
        quizResults: [],
      }
      setSession(newSession)
      lastLoggedTimeRef.current = Date.now()

      // Fetch actual YouTube video title
      fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.title) {
            setSession((prev) => (prev ? { ...prev, videoTitle: data.title } : null))
          }
        })
        .catch(() => {})
    }
  }, [videoId])

  // Log emotion every 5 seconds
  useEffect(() => {
    if (!session || !videoId || isPaused) return

    const interval = setInterval(() => {
      const now = Date.now()
      setSession(prev => {
        if (!prev) return null
        return {
          ...prev,
          emotionTimeline: [
            ...prev.emotionTimeline,
            {
              timestamp: now,
              videoTime: currentTimeRef.current,
              emotion: visionState.emotion,
              attention: visionState.attention,
            },
          ],
        }
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [session, videoId, isPaused, visionState.emotion, visionState.attention])

  // Save session on unmount or video change
  useEffect(() => {
    return () => {
      if (session) {
        const completedSession = { ...session, endTime: Date.now() }
        saveSession(completedSession)
      }
    }
  }, [session])

  // Initialize vision engine
  useEffect(() => {
    engineRef.current = new VisionEngine()
  }, [])

  // MediaPipe hook
  const { videoRef, canvasRef, startCamera, isLoaded, error, setOnResults } =
    useMediaPipe()

  // Process face landmarks from MediaPipe
  const processLandmarks = useCallback(
    (landmarks: Array<{ x: number; y: number; z: number }>) => {
      if (!engineRef.current) return

      const newState = engineRef.current.processLandmarks(landmarks)
      setVisionState(newState)

      // Trigger interventions when state changes
      if (newState.pausedReason && !isPaused && !isGenerating) {
        handleIntervention(newState.pausedReason)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPaused, isGenerating]
  )

  // Set up MediaPipe callback
  useEffect(() => {
    if (isLoaded) {
      setOnResults(processLandmarks)
    }
  }, [isLoaded, processLandmarks, setOnResults])

  // Handle intervention triggers
  const handleIntervention = useCallback(
    async (reason: string) => {
      if (isGenerating || isPaused) return

      setIsGenerating(true)
      setIsPaused(true)

      const time = currentTimeRef.current

      if (reason === 'drowsy') {
        // Filter transcript to only include segments up to current time
        const contextTranscript = transcript.filter(entry => entry.start <= time)
        console.log('Generating drowsy quiz. Total transcript:', transcript.length, 'Context segments:', contextTranscript.length)
        
        if (playerRef.current) {
          playerRef.current?.pauseVideo?.()
          console.log('Video paused for drowsy intervention')
        }

        // Log event (deduplicated within 2s)
        setSession(prev => {
          if (!prev) return null
          const last = prev.events[prev.events.length - 1]
          if (last && last.type === 'quiz' && Math.abs(Date.now() - last.timestamp) < 2000) {
            return prev
          }
          return {
            ...prev,
            events: [...prev.events, {
              timestamp: Date.now(),
              videoTime: time,
              type: 'quiz'
            }]
          }
        })
        
        const quiz = await generateQuiz(transcript, time, videoLanguage)
        setQuizData(quiz)
      } else if (reason === 'confused') {
        if (playerRef.current) {
          playerRef.current?.pauseVideo?.()
          console.log('Video paused for confused intervention')
        }

        // Log event (deduplicated within 2s)
        setSession(prev => {
          if (!prev) return null
          const last = prev.events[prev.events.length - 1]
          if (last && last.type === 'summary' && Math.abs(Date.now() - last.timestamp) < 2000) {
            return prev
          }
          return {
            ...prev,
            events: [...prev.events, {
              timestamp: Date.now(),
              videoTime: time,
              type: 'summary'
            }]
          }
        })
        
        const summary = await generateSummary(transcript, time, videoLanguage)
        setSummaryData(summary)
      } else if (reason === 'away') {
        if (playerRef.current) {
          playerRef.current?.pauseVideo?.()
          console.log('Video paused for away intervention (15s threshold)')
        }

        // Log event (deduplicated within 2s)
        setSession(prev => {
          if (!prev) return null
          const last = prev.events[prev.events.length - 1]
          if (last && last.type === 'pause' && Math.abs(Date.now() - last.timestamp) < 2000) {
            return prev
          }
          return {
            ...prev,
            events: [...prev.events, {
              timestamp: Date.now(),
              videoTime: time,
              type: 'pause',
              details: { reason: 'away_15s' }
            }]
          }
        })

        setIsAwayActive(true)
      }

      setIsGenerating(false)
    },
    [transcript, isGenerating, isPaused, videoLanguage]
  )

  // Handle loading a video
  const handleLoadVideo = useCallback(async (url: string) => {
    // If it's a direct video link or vimeo, use native player
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
    
    if (isYouTube) {
      const id = extractVideoId(url)
      if (!id) {
        alert('Invalid YouTube URL. Please enter a valid YouTube video URL.')
        return
      }

      setIsLoadingVideo(true)
      setVideoId(id)
      setFullSummaryData(null)
      setIsBreakActive(false)
      setIsRecapActive(false)
      setIsAwayActive(false)

      try {
        const res = await fetch('/api/load-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: id }),
        })

        const data = await res.json()
        if (data.transcript) {
          setTranscript(data.transcript)
          setVideoLanguage(data.language || 'en')
        }
      } catch (err) {
        console.error('Failed to load video:', err)
      } finally {
        setIsLoadingVideo(false)
      }
    } else {
      // Native/Direct video link or Vimeo
      setIsLoadingVideo(true)
      setVideoId(null) // Reset videoId for non-YT sources
      setFullSummaryData(null)
      setTranscript([]) // Reset transcript for new source
      
      if (playerRef.current) {
        playerRef.current.loadVideo(url)
      }
      
      // For non-YT videos, we don't have a transcript provider yet
      // In a real app, we might call an AI service to transcribe or provide a placeholder
      setTranscript(generateFallbackTranscript())
      setVideoLanguage('en')
      setIsLoadingVideo(false)
    }
  }, [])

  function generateFallbackTranscript() {
    return [
      { start: 0, duration: 10, text: "Welcome to this video lecture. The transcript feature is currently optimized for YouTube." },
      { start: 10, duration: 10, text: "We are using a placeholder transcript for this direct video link." },
      { start: 20, duration: 10, text: "AI emotion detection and interventions will still work based on this timing." }
    ]
  }

  // Full video summarization
  const handleSummarizeVideo = useCallback(async () => {
    if (!transcript.length || isSummarizing) return
    setIsSummarizing(true)
    try {
      const summary = await generateFullSummary(transcript)
      setFullSummaryData(summary)
    } catch (err) {
      console.error('Failed to summarize video:', err)
    } finally {
      setIsSummarizing(false)
    }
  }, [transcript, isSummarizing])

  // Handle starting camera
  const handleStartCamera = useCallback(async () => {
    await startCamera()
    setIsCameraActive(true)
  }, [startCamera])

  // Handle time update from video player
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
    currentTimeRef.current = time
  }, [])

  // Handle quiz completion
  const handleQuizComplete = useCallback((correct: number, total: number) => {
    setQuizData(null)
    // Keep isPaused true so video stays paused during break/recap

    const now = Date.now()
    const videoTime = currentTimeRef.current

    // Log quiz result to state & SQLite
    setSession(prev => {
      if (!prev) return null

      // Save to SQLite DB in background
      saveQuizResult({
        sessionId: prev.sessionId,
        score: total > 0 ? Math.round((correct / total) * 100) : 0,
        totalQuestions: total,
        correctAnswers: correct,
        videoTime,
        timestamp: now,
        videoId: prev.videoId,
      })

      return {
        ...prev,
        quizResults: [...prev.quizResults, {
          timestamp: now,
          videoTime,
          totalQuestions: total,
          correctAnswers: correct
        }]
      }
    })

    // Show Break Overlay after passing quiz
    setIsBreakActive(true)
  }, [])

  // Handle skip break (resumes video immediately)
  const handleBreakSkip = useCallback(() => {
    setIsBreakActive(false)
    setIsPaused(false)
    if (playerRef.current) {
      playerRef.current?.playVideo?.()
    }
    if (engineRef.current) {
      engineRef.current.resetState()
    }
  }, [])

  // Handle break timer end (triggers recap overlay)
  const handleBreakTimerEnd = useCallback(() => {
    setIsBreakActive(false)
    setIsRecapActive(true)
  }, [])

  // Handle recap acknowledged (resumes video)
  const handleRecapAcknowledge = useCallback(() => {
    setIsRecapActive(false)
    setIsPaused(false)
    if (playerRef.current) {
      playerRef.current?.playVideo?.()
    }
    if (engineRef.current) {
      engineRef.current.resetState()
    }
  }, [])

  // Handle away resume
  const handleAwayResume = useCallback(() => {
    setIsAwayActive(false)
    setIsPaused(false)
    if (playerRef.current) {
      playerRef.current?.playVideo?.()
    }
    if (engineRef.current) {
      engineRef.current.resetState()
    }
  }, [])

  // Handle summary dismiss
  const handleSummaryDismiss = useCallback(() => {
    setSummaryData(null)
    setIsPaused(false)
    if (playerRef.current) {
      playerRef.current?.playVideo?.()
    }
    if (engineRef.current) {
      engineRef.current.resetState()
    }
  }, [])

  // Handle simulate buttons
  const handleSimulate = useCallback(
    async (emotion: 'confused' | 'drowsy' | 'away') => {
      if (!engineRef.current || isPaused) return

      const newState = engineRef.current.simulateState(emotion)
      setVisionState(newState)

      if (newState.pausedReason) {
        handleIntervention(newState.pausedReason)
      }
    },
    [isPaused, handleIntervention]
  )

  // Determine status text and color
  const getStatusInfo = (): {
    text: string
    color: 'green' | 'red' | 'amber' | 'blue' | 'gray'
  } => {
    if (!isCameraActive) return { text: 'Camera Off', color: 'gray' }
    if (visionState.metrics.isCalibrating)
      return { text: 'Calibrating...', color: 'blue' }
    if (!visionState.metrics.faceDetected)
      return { text: 'No Face', color: 'gray' }
    if (isPaused && isAwayActive) return { text: 'Away Paused', color: 'blue' }
    if (isPaused && quizData) return { text: 'Quiz Active', color: 'red' }
    if (isPaused && summaryData)
      return { text: 'Quick Help', color: 'amber' }
    if (isGenerating) return { text: 'Generating...', color: 'blue' }

    if (visionState.emotion === 'confused') {
      const typeLabels: Record<string, string> = {
        squint: 'Confused (Squint)',
        furrow: 'Confused (Brow Furrow)',
        knit: 'Confused (Brow Knit)',
        raise: 'Confused (Raised Brow)',
        combined: 'Confused (High)',
      }
      const text = typeLabels[visionState.metrics.confusionType] || 'Confused'
      return { text, color: 'amber' }
    }

    const emotionMap: Record<
      string,
      { text: string; color: 'green' | 'red' | 'amber' | 'blue' }
    > = {
      focused: { text: 'Focused', color: 'green' },
      drowsy: { text: 'Drowsy', color: 'red' },
      away: { text: 'Looking Away', color: 'blue' },
    }

    return emotionMap[visionState.emotion] || { text: 'Active', color: 'green' }
  }

  const statusInfo = getStatusInfo()

  // Toggle native browser fullscreen on the root container
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        // Fallback: if exitFullscreen fails, still update state
        setIsFullscreen(false)
      })
    } else if (fullscreenContainerRef.current) {
      fullscreenContainerRef.current.requestFullscreen().catch(() => {
        // Fallback: if requestFullscreen fails (e.g. user gesture required),
        // fall back to CSS-based fullscreen
        setIsFullscreen(true)
      })
    }
  }, [])

  // Sync isFullscreen state with the native fullscreenchange event
  // This handles: Escape key, F key toggle, fullscreen button, browser chrome exit
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      // Ensure webcam video continues playing if browser briefly paused it during transition
      if (videoRef.current) {
        videoRef.current.play().catch(() => {})
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [videoRef])

  return (
    <div
      ref={fullscreenContainerRef}
      className="flex flex-col h-screen bg-[var(--background)] overflow-hidden"
    >
      {/* Top bar: hidden via CSS in fullscreen */}
      <div className={isFullscreen ? 'hidden' : ''}>
        <TopBar
          onLoadVideo={handleLoadVideo}
          isLoading={isLoadingVideo}
          statusText={statusInfo.text}
          statusColor={statusInfo.color}
          isTracking={isCameraActive && visionState.metrics.faceDetected}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: hidden via CSS in fullscreen */}
        <aside
          className={`w-16 border-r border-[var(--border)] bg-[var(--surface-1)] flex flex-col items-center py-4 gap-4 shrink-0 ${
            isFullscreen ? 'hidden' : ''
          }`}
        >
          <button
            onClick={() => setActiveTab('player')}
            className={`p-3 rounded-xl transition-all ${
              activeTab === 'player'
                ? 'bg-[var(--neon-blue)]/10 text-[var(--neon-blue)] shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
            }`}
            title="Video Player"
          >
            <VideoIcon size={20} />
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`p-3 rounded-xl transition-all ${
              activeTab === 'analytics'
                ? 'bg-[var(--neon-blue)]/10 text-[var(--neon-blue)] shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
            }`}
            title="Learning Analytics"
          >
            <LayoutDashboard size={20} />
          </button>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'player' ? (
            <>
              {/* Main area - Video Player */}
              <main
                className={
                  isFullscreen
                    ? 'fixed inset-0 z-40 w-screen h-screen bg-black p-0 m-0 rounded-none flex flex-col overflow-hidden'
                    : 'flex-1 flex flex-col overflow-hidden relative p-4 gap-4'
                }
              >
                <div className="relative flex-1">
                  <VideoPlayer
                    ref={playerRef}
                    videoId={videoId}
                    isPaused={isPaused}
                    onTimeUpdate={handleTimeUpdate}
                    transcript={transcript}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                  />

                  {/* Quiz Overlay */}
                  {quizData && (
                    <QuizOverlay quiz={quizData} onComplete={handleQuizComplete} />
                  )}

                  {/* Break Overlay (shown after passing quiz) */}
                  {isBreakActive && (
                    <BreakOverlay
                      onSkip={handleBreakSkip}
                      onTimerEnd={handleBreakTimerEnd}
                    />
                  )}

                  {/* Recap Overlay (shown after break finishes) */}
                  {isRecapActive && (
                    <RecapOverlay
                      transcript={transcript}
                      currentTime={currentTime}
                      videoLanguage={videoLanguage}
                      onAcknowledge={handleRecapAcknowledge}
                    />
                  )}

                  {/* Away Overlay (15-second sustained away) */}
                  {isAwayActive && (
                    <AwayOverlay onResume={handleAwayResume} />
                  )}

                  {/* Summary Overlay (confusion quick help) */}
                  {summaryData && (
                    <SummaryOverlay
                      summary={summaryData}
                      onDismiss={handleSummaryDismiss}
                    />
                  )}

                  {/* Full Summary Overlay */}
                  {fullSummaryData && (
                    <FullSummaryOverlay
                      summary={fullSummaryData}
                      onDismiss={() => setFullSummaryData(null)}
                    />
                  )}

                  {/* Generating spinner overlay */}
                  {isGenerating && (
                    <div className="overlay-backdrop absolute inset-0 z-30 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-[var(--neon-green)] animate-spin" />
                        <p className="text-sm text-[var(--foreground)]">
                          Generating content...
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom action bar: hidden in fullscreen */}
                {videoId && transcript.length > 0 && (
                  <div className={`flex items-center gap-3 ${isFullscreen ? 'hidden' : ''}`}>
                    <button
                      onClick={handleSummarizeVideo}
                      disabled={isSummarizing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--neon-blue)]/10 border border-[var(--neon-blue)]/30 text-[var(--neon-blue)] text-sm font-semibold hover:bg-[var(--neon-blue)]/20 transition-colors disabled:opacity-40"
                    >
                      {isSummarizing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <BookOpen className="w-4 h-4" />
                      )}
                      {isSummarizing ? 'Summarizing...' : 'Summarize Full Video'}
                    </button>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {transcript.length} transcript segments loaded
                    </span>
                  </div>
                )}

                {/* Gaze away toast — inside <main> so it renders in native fullscreen */}
                <GazeToast isVisible={visionState.emotion === 'away'} />

                {/* Debug Panel — inside <main> so it renders in native fullscreen */}
                <DebugPanel 
                  visionState={visionState} 
                  currentTime={currentTime}
                  baselineEAR={engineRef.current?.getBaselines().ear || 0}
                  baselineBrow={engineRef.current?.getBaselines().brow || 0}
                  baselineInterBrow={engineRef.current?.getBaselines().interBrow || 0}
                />
              </main>

              {/* Right Sidebar: always mounted in the JSX so React never unmounts videoRef / canvasRef */}
              <aside
                className={
                  isFullscreen
                    ? 'opacity-0 pointer-events-none fixed top-0 left-0 w-px h-px overflow-hidden -z-10'
                    : 'w-80 border-l border-[var(--border)] bg-[var(--surface-1)] flex flex-col overflow-hidden shrink-0'
                }
              >
                  {/* Webcam section */}
                  <div className="p-4 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                        Webcam Feed
                      </h2>
                      {!isCameraActive && (
                        <button
                          onClick={handleStartCamera}
                          className="px-3 py-1 rounded-lg bg-[var(--neon-green)] text-[var(--surface-0)] text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          Start Camera
                        </button>
                      )}
                    </div>

                    <div className="relative rounded-xl overflow-hidden bg-[var(--surface-0)] border border-[var(--border)] aspect-[4/3]">
                      <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover opacity-0"
                        playsInline
                        muted
                      />
                      <canvas
                        ref={canvasRef}
                        width={320}
                        height={240}
                        className="w-full h-full object-cover"
                      />

                      {!isCameraActive && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              className="w-10 h-10 text-[var(--surface-3)] mx-auto mb-2"
                              stroke="currentColor"
                              strokeWidth={1}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                              />
                            </svg>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              Click &quot;Start Camera&quot;
                            </p>
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-0)]/90 p-4">
                          <p className="text-xs text-[var(--neon-red)] text-center">
                            {error}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scrollable metrics area */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
                    {/* Metrics */}
                    <MetricBars
                      ear={visionState.metrics.ear}
                      earRatio={visionState.metrics.earRatio}
                      browRatioChange={visionState.metrics.browRatioChange}
                      interBrowChange={visionState.metrics.interBrowChange}
                      confusionScore={visionState.metrics.confusionScore}
                      confusionType={visionState.metrics.confusionType}
                      gazeOffCenter={visionState.metrics.gazeOffCenter}
                      attention={visionState.attention}
                      isCalibrating={visionState.metrics.isCalibrating}
                      calibrationProgress={visionState.metrics.calibrationProgress}
                      faceDetected={visionState.metrics.faceDetected}
                    />

                    {/* Transcript */}
                    <div className="flex flex-col gap-2">
                      <h2 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                        Live Transcript
                      </h2>
                      <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3">
                        <TranscriptPanel
                          transcript={transcript}
                          currentTime={currentTime}
                        />
                      </div>
                    </div>

                    {/* Simulate buttons */}
                    <SimulateButtons
                      onSimulate={handleSimulate}
                      disabled={isPaused || !videoId}
                    />

                    {/* Debug info */}
                    <div className="flex flex-col gap-1 pb-4">
                      <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                        Debug Info
                      </span>
                      <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] font-mono text-xs text-[var(--muted-foreground)] space-y-1">
                        <p>State: {visionState.emotion}</p>
                        <p>Confusion: {visionState.metrics.confusionScore}% ({visionState.metrics.confusionType})</p>
                        <p>Paused: {visionState.pausedReason || 'none'}</p>
                        <p>Video Time: {currentTime.toFixed(1)}s</p>
                        <p>Transcript entries: {transcript.length}</p>
                        <p>Camera: {isCameraActive ? 'Active' : 'Off'}</p>
                      </div>
                    </div>
                  </div>
                </aside>
            </>
          ) : (
            <main className="flex-1 p-6 overflow-y-auto bg-[var(--background)]">
              <div className="max-w-6xl mx-auto">
                <AnalyticsDashboard />
              </div>
            </main>
          )}
        </div>
      </div>

    </div>
  )
}
