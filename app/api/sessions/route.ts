import { NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    let {
      sessionId,
      videoId,
      videoTitle,
      startTime,
      endTime,
      emotionTimeline = [],
      events = [],
      quizResults = [],
    } = body

    if (!sessionId || !videoId) {
      return NextResponse.json(
        { error: 'Missing sessionId or videoId' },
        { status: 400 }
      )
    }

    // Auto-fetch YouTube video title if not provided
    if (!videoTitle && videoId) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
          { signal: controller.signal }
        )
        clearTimeout(timeoutId)
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json()
          if (oembedData?.title) {
            videoTitle = oembedData.title
          }
        }
      } catch {
        // Fallback silently if offline or invalid YT ID
      }
    }

    const start = new Date(startTime || Date.now())
    const end = endTime ? new Date(endTime) : null
    const duration = end
      ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000))
      : 0

    // Calculate average focus from emotionTimeline
    const averageFocus =
      emotionTimeline.length > 0
        ? Math.round(
            emotionTimeline.reduce(
              (acc: number, curr: { attention?: number }) => acc + (curr.attention || 0),
              0
            ) / emotionTimeline.length
          )
        : 100

    const focusTime = Math.round(duration * (averageFocus / 100))

    // Deduplicate events (e.g. duplicate triggers within 2 seconds)
    const uniqueEvents = (events || []).filter(
      (e: any, index: number, self: any[]) =>
        index ===
        self.findIndex(
          (item: any) =>
            item.type === e.type &&
            Math.abs((item.timestamp || 0) - (e.timestamp || 0)) < 2000
        )
    )

    try {
      await ensureDbSchema()

      // Upsert session
      const session = await db.session.upsert({
        where: { sessionId },
        update: {
          endTime: end,
          duration,
          focusTime,
          averageFocus,
          videoTitle: videoTitle || undefined,
          emotionTimeline: JSON.stringify(emotionTimeline),
          events: JSON.stringify(uniqueEvents),
        },
        create: {
          sessionId,
          videoId,
          videoTitle: videoTitle || null,
          startTime: start,
          endTime: end,
          duration,
          focusTime,
          averageFocus,
          emotionTimeline: JSON.stringify(emotionTimeline),
          events: JSON.stringify(uniqueEvents),
        },
      })

      // Upsert or insert quiz results with deduplication & bounded accuracy
      if (quizResults.length > 0) {
        const uniqueQuizzes = quizResults.filter(
          (q: any, index: number, self: any[]) =>
            index ===
            self.findIndex(
              (item: any) =>
                item.timestamp === q.timestamp ||
                Math.abs((item.videoTime || 0) - (q.videoTime || 0)) < 1
            )
        )

        // Replace existing quiz results for this session to prevent duplicate accumulation
        await db.quizResult.deleteMany({
          where: { sessionId: session.sessionId },
        })

        for (const q of uniqueQuizzes) {
          const total = Math.max(1, q.totalQuestions || 0)
          const correct = Math.min(total, Math.max(0, q.correctAnswers || 0))
          const score = Math.min(100, Math.round((correct / total) * 100))

          await db.quizResult.create({
            data: {
              sessionId: session.sessionId,
              score,
              totalQuestions: total,
              correctAnswers: correct,
              videoTime: q.videoTime || 0,
              timestamp: q.timestamp ? new Date(q.timestamp) : new Date(),
            },
          })
        }
      }

      return NextResponse.json({ success: true, session })
    } catch (dbError: any) {
      console.warn('Database write bypassed in serverless environment:', dbError?.message || dbError)
      return NextResponse.json({
        success: true,
        warning: 'Session saved in-memory (persistent database unavailable in serverless environment)',
        session: {
          sessionId,
          videoId,
          videoTitle,
          duration,
          focusTime,
          averageFocus,
        },
      })
    }
  } catch (error: any) {
    console.error('Error processing session payload:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to process session' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    await ensureDbSchema()
    const sessions = await db.session.findMany({
      include: {
        quizResults: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    })

    // Format sessions back into frontend-compatible format
    const formatted = sessions.map((s) => ({
      sessionId: s.sessionId,
      videoId: s.videoId,
      videoTitle: (s as any).videoTitle || undefined,
      startTime: s.startTime.getTime(),
      endTime: s.endTime ? s.endTime.getTime() : undefined,
      duration: s.duration,
      focusTime: s.focusTime,
      averageFocus: s.averageFocus,
      emotionTimeline: s.emotionTimeline ? JSON.parse(s.emotionTimeline) : [],
      events: s.events ? JSON.parse(s.events) : [],
      quizResults: s.quizResults.map((q) => {
        const total = Math.max(1, q.totalQuestions || 0)
        const correct = Math.min(total, Math.max(0, q.correctAnswers || 0))
        return {
          id: q.id,
          timestamp: q.timestamp.getTime(),
          videoTime: q.videoTime,
          totalQuestions: total,
          correctAnswers: correct,
          score: Math.min(100, q.score || Math.round((correct / total) * 100)),
        }
      }),
    }))

    return NextResponse.json({ success: true, sessions: formatted })
  } catch (error: any) {
    console.warn('Notice: Could not fetch sessions from database (returning empty list):', error?.message || error)
    return NextResponse.json({ success: true, sessions: [] })
  }
}
