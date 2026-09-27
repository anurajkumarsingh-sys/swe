/**
 * Smart-Lecture v4 - Content Engine
 * Handles:
 * - YouTube transcript processing
 * - OpenAI quiz generation (3-question MCQ via API route)
 * - OpenAI confusion-triggered summary (last 2 min via API route)
 * - OpenAI full video summarization (via API route)
 * - Fallback dummy data when no API key
 */

export const CRITICAL_LANGUAGE_RULE =
  "CRITICAL LANGUAGE RULE: Even if the input transcript is in Devanagari Hindi script (e.g., 'इज़ कंटीन्यूअस इंटीग्रेशन'), you MUST NEVER output Devanagari script (अ-ज्ञ). Always write all quiz questions, options, summaries, and recaps in clear English or natural Hinglish (Roman/Latin alphabet only), and always use proper English spellings for all English and technical words (e.g., 'continuous integration', 'practical example', 'e-commerce application')."

export interface TranscriptEntry {
  start: number
  duration: number
  text: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export interface QuizData {
  questions: QuizQuestion[]
}

export interface SummaryData {
  summary: string
  topic: string
}

export interface RecapData {
  topic: string
  bullets: string[]
}

export interface FullSummarySection {
  heading: string
  content: string
}

export interface FullSummaryData {
  title: string
  overview: string
  sections: FullSummarySection[]
  keyTakeaways: string[]
}

/**
 * Extract transcript from a window of time
 */
export function getTranscriptWindow(
  transcript: TranscriptEntry[],
  currentTime: number,
  windowSeconds: number
): string {
  const startTime = Math.max(0, currentTime - windowSeconds)
  const relevantEntries = transcript.filter(
    (entry) => entry.start >= startTime && entry.start < currentTime
  )
  return relevantEntries.map((e) => e.text).join(' ')
}

/**
 * Get transcript up to a given time (for quiz context — "part of video played so far")
 */
export function getTranscriptUpTo(
  transcript: TranscriptEntry[],
  currentTime: number
): string {
  const relevantEntries = transcript.filter(
    (entry) => entry.start <= currentTime
  )
  return relevantEntries.map((e) => e.text).join(' ')
}

/**
 * Generate a 3-question MCQ quiz via API route based on video played so far
 */
export async function generateQuiz(
  transcript: TranscriptEntry[],
  currentTime: number,
  videoLanguage: string = 'en'
): Promise<QuizData> {
  if (!transcript || transcript.length === 0) {
    return getFallbackQuiz()
  }

  // Filter all entries up to currentTime
  let playedEntries = transcript.filter((e) => e.start <= Math.max(currentTime, 30))

  // If at start of video or early, take first 8-10 entries to cover the intro
  if (playedEntries.length < 3) {
    playedEntries = transcript.slice(0, 10)
  }

  // Use the most recent 20 played entries for the quiz
  const contextEntries = playedEntries.slice(-20)
  let contextText = contextEntries.map((e) => e.text).join(' ').trim()

  if (!contextText || contextText.length < 5) {
    contextText = transcript.slice(0, 5).map((e) => e.text).join(' ').trim()
  }

  if (!contextText) {
    return getFallbackQuiz()
  }

  try {
    const res = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: contextText, language: videoLanguage }),
    })

    if (!res.ok) return getFallbackQuiz()

    const data = await res.json()
    if (data.quiz?.questions && Array.isArray(data.quiz.questions)) {
      return data.quiz as QuizData
    }
    return getFallbackQuiz()
  } catch (e) {
    console.warn('Quiz fetch fallback:', e)
    return getFallbackQuiz()
  }
}

/**
 * Generate confusion-triggered summary via API route (last 2 minutes)
 */
export async function generateSummary(
  transcript: TranscriptEntry[],
  currentTime: number,
  videoLanguage: string = 'en'
): Promise<SummaryData> {
  if (!transcript || transcript.length === 0) {
    return {
      summary: 'Please load a lecture video to start receiving real-time AI summaries and explanations.',
      topic: 'Lecture Overview',
    }
  }

  // Get entries for the last 120s up to currentTime
  const startTime = Math.max(0, currentTime - 120)
  let relevantEntries = transcript.filter(
    (e) => e.start >= startTime && e.start <= currentTime + 5
  )

  // If very early in video or short window, pull latest played entries or intro
  if (relevantEntries.length < 2) {
    relevantEntries = transcript.filter((e) => e.start <= Math.max(currentTime, 60))
    if (relevantEntries.length < 2) {
      relevantEntries = transcript.slice(0, 8)
    }
  }

  let contextText = relevantEntries.map((e) => e.text).join(' ').trim()
  if (!contextText || contextText.length < 5) {
    contextText = transcript.slice(0, 5).map((e) => e.text).join(' ').trim()
  }

  if (!contextText) {
    return {
      summary: 'The instructor is introducing core lecture concepts. Pay close attention to key definitions.',
      topic: 'Lecture Overview',
    }
  }

  try {
    const res = await fetch('/api/generate-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: contextText, language: videoLanguage }),
    })

    if (!res.ok) {
      return {
        summary: 'The instructor is explaining this section. Focus on the key concepts presented on screen.',
        topic: 'Lecture Discussion',
      }
    }

    const data = await res.json()
    if (data.summary) return data.summary
    return { summary: 'Summary unavailable.', topic: 'Error' }
  } catch (e) {
    console.warn('Summary fetch fallback:', e)
    return {
      summary: 'The instructor is introducing core lecture concepts. Focus on the main ideas presented.',
      topic: 'Lecture Discussion',
    }
  }
}

/**
 * Generate post-break recap via API route (last 2-3 minutes of lecture context)
 */
export async function generateRecap(
  transcript: TranscriptEntry[],
  currentTime: number,
  videoLanguage: string = 'en'
): Promise<RecapData> {
  const fallbackRecap: RecapData = {
    topic: 'Lecture Catch-up & Context',
    bullets: [
      'The instructor discussed the foundational concepts right before your break.',
      'Key principles and examples were being established on screen.',
      'You are now set to dive back into the lecture smoothly.'
    ]
  }

  if (!transcript || transcript.length === 0) {
    return fallbackRecap
  }

  // Get entries for the last 180s up to currentTime
  const startTime = Math.max(0, currentTime - 180)
  let relevantEntries = transcript.filter(
    (e) => e.start >= startTime && e.start <= currentTime + 5
  )

  if (relevantEntries.length < 2) {
    relevantEntries = transcript.filter((e) => e.start <= Math.max(currentTime, 60))
    if (relevantEntries.length < 2) {
      relevantEntries = transcript.slice(0, 10)
    }
  }

  let contextText = relevantEntries.map((e) => e.text).join(' ').trim()
  if (!contextText || contextText.length < 5) {
    contextText = transcript.slice(0, 5).map((e) => e.text).join(' ').trim()
  }

  if (!contextText) {
    return fallbackRecap
  }

  try {
    const res = await fetch('/api/generate-recap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: contextText, language: videoLanguage }),
    })

    if (!res.ok) return fallbackRecap

    const data = await res.json()
    if (data.recap?.bullets && Array.isArray(data.recap.bullets)) {
      return data.recap as RecapData
    }
    return fallbackRecap
  } catch (e) {
    console.warn('Recap fetch fallback:', e)
    return fallbackRecap
  }
}

/**
 * Generate full video summary via API route
 */
export async function generateFullSummary(
  transcript: TranscriptEntry[]
): Promise<FullSummaryData> {
  if (!transcript || transcript.length === 0) {
    return getFallbackFullSummary()
  }

  try {
    const res = await fetch('/api/summarize-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    })

    if (!res.ok) return getFallbackFullSummary()

    const data = await res.json()
    if (data.fullSummary) return data.fullSummary
    return getFallbackFullSummary()
  } catch {
    return getFallbackFullSummary()
  }
}

/**
 * Extract YouTube video ID from URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function getFallbackQuiz(): QuizData {
  return {
    questions: [
      {
        question: 'Based on the recent lecture content, which concept was primarily discussed?',
        options: [
          'Data structures and algorithms',
          'Machine learning fundamentals',
          'Web development patterns',
          'Database optimization',
        ],
        correct: 1,
        explanation: 'The recent segment covered fundamental machine learning concepts.',
      },
      {
        question: 'What was the main teaching approach used in this segment?',
        options: [
          'Pure theoretical exposition',
          'Practical examples with walkthroughs',
          'Student-led discussion',
          'Reading from textbook',
        ],
        correct: 1,
        explanation: 'The instructor used practical examples to demonstrate the concept.',
      },
      {
        question: 'Which best describes the key takeaway from this segment?',
        options: [
          'Memorizing formulas is essential',
          'Understanding the underlying process is more important',
          'Only advanced students need this knowledge',
          'This topic is unrelated to the course',
        ],
        correct: 1,
        explanation: 'The emphasis was on understanding the process rather than rote memorization.',
      },
    ],
  }
}

function getFallbackFullSummary(): FullSummaryData {
  return {
    title: 'Lecture Summary',
    overview:
      'This lecture covered several important topics including foundational concepts, practical examples, and key takeaways.',
    sections: [
      {
        heading: 'Introduction',
        content: 'The lecture began with an overview of the subject matter and its relevance.',
      },
      {
        heading: 'Core Concepts',
        content: 'Key theories and frameworks were introduced with detailed explanations.',
      },
      {
        heading: 'Conclusion',
        content: 'The session wrapped up with a review of critical points.',
      },
    ],
    keyTakeaways: [
      'Understand the fundamental principles discussed',
      'Practice applying concepts to real-world scenarios',
      'Review supplementary materials for deeper understanding',
    ],
  }
}
