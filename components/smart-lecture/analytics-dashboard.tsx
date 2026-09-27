'use client'

import { useEffect, useState } from 'react'
import { getSessions, SessionAnalytics, calculateDailyStats, DailyStats } from '@/lib/analytics'
import {
  BarChart3,
  Clock,
  Brain,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  History,
  Loader2,
  Pause,
  Flame,
  Sparkles,
  Zap,
  TrendingUp,
} from 'lucide-react'

function formatVideoTime(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds || 0))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function AnalyticsDashboard() {
  const [sessions, setSessions] = useState<SessionAnalytics[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [videoTitles, setVideoTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const data = await getSessions()
        setSessions(data)
        if (data.length > 0) {
          setSelectedSession(data[0])
        }
      } catch (err) {
        console.error('Failed to load sessions:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  // Auto-resolve video titles for YouTube videos missing title
  useEffect(() => {
    sessions.forEach((s) => {
      if (s.videoTitle) {
        setVideoTitles((prev) => (prev[s.videoId] ? prev : { ...prev, [s.videoId]: s.videoTitle! }))
      } else if (s.videoId && !videoTitles[s.videoId]) {
        fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(s.videoId)}&format=json`)
          .then((r) => r.json())
          .then((data) => {
            if (data?.title) {
              setVideoTitles((prev) => ({ ...prev, [s.videoId]: data.title }))
            }
          })
          .catch(() => {})
      }
    })
  }, [sessions, videoTitles])

  const getVideoTitle = (s: SessionAnalytics): string => {
    if (s.videoTitle && s.videoTitle.trim()) return s.videoTitle
    if (videoTitles[s.videoId]) return videoTitles[s.videoId]
    return `Video: ${s.videoId}`
  }

  const dailyStats: DailyStats = calculateDailyStats(sessions)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl">
        <Loader2 className="w-8 h-8 text-[var(--neon-blue)] animate-spin mb-3" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading learning history from database...</p>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[var(--neon-amber)]/15 border border-[var(--neon-amber)]/30 flex items-center justify-center mb-4">
          <Flame className="w-8 h-8 text-[var(--neon-amber)] animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Start Your Learning Streak</h3>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm mb-4">
          Watch a lecture video with AI engagement tracking to start recording your daily streak and focus history.
        </p>
      </div>
    )
  }

  // Deduplicate events for the currently selected session
  const uniqueEvents = (selectedSession?.events || []).filter(
    (event, index, self) =>
      index ===
      self.findIndex(
        (e) =>
          e.type === event.type &&
          Math.abs((e.timestamp || 0) - (event.timestamp || 0)) < 2000
      )
  )

  // Quiz Accuracy calculations for selected session
  const selTotalQuestions = (selectedSession?.quizResults || []).reduce(
    (acc, curr) => acc + (curr.totalQuestions || 0),
    0
  )
  const selCorrectAnswers = Math.min(
    selTotalQuestions,
    Math.max(
      0,
      (selectedSession?.quizResults || []).reduce(
        (acc, curr) => acc + (curr.correctAnswers || 0),
        0
      )
    )
  )
  const selQuizAccuracy =
    selTotalQuestions > 0
      ? Math.min(100, Math.round((selCorrectAnswers / selTotalQuestions) * 100))
      : 0

  return (
    <div className="flex flex-col gap-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--neon-blue)]/20 flex items-center justify-center border border-[var(--neon-blue)]/30">
            <LayoutDashboard className="w-5 h-5 text-[var(--neon-blue)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Learning Dashboard</h2>
            <p className="text-xs text-[var(--muted-foreground)] font-medium">Daily habits &amp; cognitive engagement analytics</p>
          </div>
        </div>

        {/* Quick Streak Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--neon-amber)]/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]">
          <Flame className="w-4 h-4 text-[var(--neon-amber)] animate-pulse" />
          <span className="text-xs font-bold text-[var(--neon-amber)]">
            {dailyStats.currentStreak} Day Streak
          </span>
        </div>
      </div>

      {/* Gamification & Daily Summary Banner (Part 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Daily Streak Counter */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-2)] border border-[var(--neon-amber)]/35 shadow-[0_0_25px_-5px_rgba(245,158,11,0.15)] group hover:border-[var(--neon-amber)]/70 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-[var(--neon-amber)]/10 blur-[40px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--muted-foreground)]">
              Daily Streak
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--neon-amber)]/20 text-[var(--neon-amber)] flex items-center justify-center border border-[var(--neon-amber)]/30">
              <Flame className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1.5 relative z-10">
            <span className="text-3xl font-mono font-bold text-[var(--neon-amber)] tracking-tight">
              🔥 {dailyStats.currentStreak}
            </span>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {dailyStats.currentStreak === 1 ? 'Day Streak' : 'Days Streak'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] leading-tight relative z-10">
            {dailyStats.currentStreak > 0
              ? 'You are on fire! Keep studying today to extend your streak.'
              : 'Complete a study session today to start your streak!'}
          </p>
        </div>

        {/* Card 2: Today's Total Watch Time */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-2)] border border-[var(--neon-blue)]/35 shadow-[0_0_25px_-5px_rgba(59,130,246,0.15)] group hover:border-[var(--neon-blue)]/70 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-[var(--neon-blue)]/10 blur-[40px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--muted-foreground)]">
              Today&apos;s Watch Time
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--neon-blue)]/20 text-[var(--neon-blue)] flex items-center justify-center border border-[var(--neon-blue)]/30">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1.5 relative z-10">
            <span className="text-3xl font-mono font-bold text-[var(--foreground)] tracking-tight">
              {dailyStats.todayWatchTimeMinutes >= 60
                ? `${Math.floor(dailyStats.todayWatchTimeMinutes / 60)}h ${dailyStats.todayWatchTimeMinutes % 60}m`
                : `${dailyStats.todayWatchTimeMinutes}m`}
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] leading-tight relative z-10">
            {dailyStats.todaySessionsCount > 0
              ? `${dailyStats.todaySessionsCount} session${dailyStats.todaySessionsCount === 1 ? '' : 's'} recorded today`
              : 'No sessions logged yet today'}
          </p>
        </div>

        {/* Card 3: Today's Average Focus */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-2)] border border-[var(--neon-green)]/35 shadow-[0_0_25px_-5px_rgba(34,197,94,0.15)] group hover:border-[var(--neon-green)]/70 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-[var(--neon-green)]/10 blur-[40px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--muted-foreground)]">
              Today&apos;s Avg Focus
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--neon-green)]/20 text-[var(--neon-green)] flex items-center justify-center border border-[var(--neon-green)]/30">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1.5 relative z-10">
            <span className="text-3xl font-mono font-bold text-[var(--neon-green)] tracking-tight">
              {dailyStats.todaySessionsCount > 0 ? `${dailyStats.todayAverageFocus}%` : '--'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] leading-tight relative z-10">
            {dailyStats.todaySessionsCount > 0
              ? 'Computed from real-time webcam attention'
              : 'Attention score across today\'s sessions'}
          </p>
        </div>

        {/* Card 4: Daily Achievements / Checkpoints */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-2)] border border-[var(--neon-purple)]/35 shadow-[0_0_25px_-5px_rgba(168,85,247,0.15)] group hover:border-[var(--neon-purple)]/70 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-[var(--neon-purple)]/10 blur-[40px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--muted-foreground)]">
              Learning Days
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--neon-purple)]/20 text-[var(--neon-purple)] flex items-center justify-center border border-[var(--neon-purple)]/30">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1.5 relative z-10">
            <span className="text-3xl font-mono font-bold text-[var(--foreground)] tracking-tight">
              {dailyStats.daysActive}
            </span>
            <span className="text-sm font-semibold text-[var(--muted-foreground)]">
              {dailyStats.daysActive === 1 ? 'day active' : 'days active'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] leading-tight relative z-10">
            {dailyStats.todayQuizzesCount > 0
              ? `${dailyStats.todayQuizzesCount} quiz checkpoints completed today`
              : 'Consistency is key to mastery'}
          </p>
        </div>
      </div>

      {/* Main Layout: Recent Sessions List & Selected Session Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session List */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1 mb-1">
            <History className="w-4 h-4 text-[var(--muted-foreground)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Recent Sessions</span>
          </div>
          <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2">
            {sessions.map((s) => {
              const totalQ = (s.quizResults || []).reduce(
                (acc, curr) => acc + (curr.totalQuestions || 0),
                0
              )
              const totalC = Math.min(
                totalQ,
                Math.max(
                  0,
                  (s.quizResults || []).reduce(
                    (acc, curr) => acc + (curr.correctAnswers || 0),
                    0
                  )
                )
              )

              return (
                <button
                  key={s.sessionId}
                  onClick={() => setSelectedSession(s)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedSession?.sessionId === s.sessionId
                      ? 'bg-[var(--neon-blue)]/10 border-[var(--neon-blue)] shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                      : 'bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--muted-foreground)]/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-[var(--muted-foreground)]">
                      {new Date(s.startTime).toLocaleDateString()}
                    </span>
                    {totalQ > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 text-[10px] font-bold text-[var(--neon-green)] font-mono">
                        {totalC}/{totalQ} Correct
                      </span>
                    )}
                  </div>
                  <h4
                    className="text-sm font-bold text-[var(--foreground)] mb-1 truncate"
                    title={getVideoTitle(s)}
                  >
                    {getVideoTitle(s)}
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.max(1, Math.round(((s.endTime || Date.now()) - s.startTime) / 60000))} mins
                    </span>
                    <span className="flex items-center gap-1">
                      <Brain className="w-3 h-3" />
                      Avg Focus: {s.averageFocus !== undefined ? Math.round(s.averageFocus) : Math.round((s.emotionTimeline || []).reduce((acc, curr) => acc + curr.attention, 0) / (s.emotionTimeline.length || 1))}%
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Session Details */}
        <div className="lg:col-span-2">
          {selectedSession ? (
            <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-start">
                <div className="max-w-[70%]">
                  <h3 className="text-lg font-bold text-[var(--foreground)] mb-1 truncate" title={getVideoTitle(selectedSession)}>
                    {getVideoTitle(selectedSession)}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Session started {new Date(selectedSession.startTime).toLocaleString()}
                  </p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-center shrink-0">
                  <span className="block text-[10px] uppercase font-bold text-[var(--muted-foreground)] mb-0.5">Overall Focus</span>
                  <span className="text-xl font-mono font-bold text-[var(--neon-green)]">
                    {selectedSession.averageFocus !== undefined
                      ? Math.round(selectedSession.averageFocus)
                      : Math.round((selectedSession.emotionTimeline || []).reduce((acc, curr) => acc + curr.attention, 0) / (selectedSession.emotionTimeline.length || 1))}%
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] block mb-1">Interventions</span>
                  <span className="text-2xl font-mono font-bold text-[var(--foreground)]">{uniqueEvents.length}</span>
                </div>
                <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] block mb-1">Quiz Accuracy</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-mono font-bold text-[var(--foreground)]">
                      {selQuizAccuracy}%
                    </span>
                    {selTotalQuestions > 0 && (
                      <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                        ({selCorrectAnswers}/{selTotalQuestions})
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] block mb-1">Drowsy Moments</span>
                  <span className="text-2xl font-mono font-bold text-[var(--neon-red)]">
                    {uniqueEvents.filter((e) => e.type === 'quiz').length}
                  </span>
                </div>
              </div>

              {/* Timeline Visualization */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Activity Timeline</h4>
                <div className="flex flex-col gap-2">
                  {uniqueEvents.map((e, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-[var(--surface-0)] border border-[var(--border)]">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        e.type === 'quiz'
                          ? 'bg-[var(--neon-red)]/20 text-[var(--neon-red)]'
                          : e.type === 'pause'
                          ? 'bg-[var(--neon-blue)]/20 text-[var(--neon-blue)]'
                          : 'bg-[var(--neon-amber)]/20 text-[var(--neon-amber)]'
                      }`}>
                        {e.type === 'quiz' ? (
                          <AlertCircle size={16} />
                        ) : e.type === 'pause' ? (
                          <Pause size={16} />
                        ) : (
                          <Brain size={16} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[var(--foreground)] capitalize">
                          {e.type === 'pause' ? 'Away Pause (15s)' : `${e.type} Intervention`}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)] font-mono">
                          At {formatVideoTime(e.videoTime)}
                        </p>
                      </div>
                      {e.type === 'quiz' && (
                        <div className="text-right">
                          <p className="text-xs font-bold text-[var(--foreground)]">Drowsiness Test</p>
                          <p className="text-[10px] text-[var(--neon-green)] font-semibold">Completed</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {uniqueEvents.length === 0 && (
                    <p className="text-center py-8 text-xs text-[var(--muted-foreground)] bg-[var(--surface-0)] rounded-xl border border-dashed border-[var(--border)]">
                      Excellent session! No interventions were needed.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl border-dashed">
              <BarChart3 className="w-12 h-12 text-[var(--muted-foreground)] mb-4 opacity-20" />
              <h3 className="text-sm font-semibold text-[var(--muted-foreground)]">Select a session to view details</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AlertCircle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
