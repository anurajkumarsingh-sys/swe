import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { context, language = 'en' } = await req.json()

    if (!context || context.trim().length < 5) {
      return NextResponse.json({
        quiz: generateFallbackQuiz(context || 'Lecture overview and fundamentals'),
      })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!groqApiKey && !geminiApiKey && !openaiApiKey) {
      return NextResponse.json({ quiz: generateFallbackQuiz(context) })
    }

    const prompt = `You are an educational quiz generator. Based on the following lecture transcript excerpt, generate exactly THREE multiple-choice questions to test the student's understanding.

CRITICAL LANGUAGE RULE: Even if the input transcript is in Devanagari Hindi script (e.g., 'इज़ कंटीन्यूअस इंटीग्रेशन'), you MUST NEVER output Devanagari script (अ-ज्ञ). Always write all quiz questions, options, summaries, and recaps in clear English or natural Hinglish (Roman/Latin alphabet only), and always use proper English spellings for all English and technical words (e.g., 'continuous integration', 'practical example', 'e-commerce application').

TRANSCRIPT:
"""
${context}
"""

You MUST respond with ONLY valid JSON in this exact format, no other text:
{
  "questions": [
    {
      "question": "Your question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of why the correct answer is right."
    },
    {
      "question": "Second question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 1,
      "explanation": "Brief explanation."
    },
    {
      "question": "Third question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 2,
      "explanation": "Brief explanation."
    }
  ]
}

The "correct" field is the 0-based index of the correct option.`

    // Helper to shuffle quiz options
    const processQuizResponse = (text: string) => {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.questions && Array.isArray(parsed.questions)) {
          parsed.questions = parsed.questions.map((q: any) => {
            const options = [...q.options]
            const correctIndex = typeof q.correct === 'number' ? q.correct : 0
            const correctOptionText = options[correctIndex] || options[0]
            for (let i = options.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [options[i], options[j]] = [options[j], options[i]]
            }
            return { ...q, options, correct: options.indexOf(correctOptionText) }
          })
          return parsed
        }
      } catch (e) {
        console.error('Failed to parse quiz json:', e)
      }
      return null
    }

    // ── 1️⃣ Try GROQ first (fast, 14,400 req/day free) ──────────────────────
    if (groqApiKey) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqApiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: 'openai/gpt-oss-20b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 2000,
          }),
        })
        clearTimeout(timeoutId)

        if (groqRes.ok) {
          const groqData = await groqRes.json()
          const text = groqData?.choices?.[0]?.message?.content || ''
          const quiz = processQuizResponse(text)
          if (quiz) {
            console.log('Quiz generated via Groq ✅')
            return NextResponse.json({ quiz })
          }
        } else {
          console.warn('Groq Quiz error:', groqRes.status, await groqRes.text())
        }
      } catch (groqErr: any) {
        if (groqErr.name === 'AbortError') {
          console.warn('Groq Quiz timed out, falling back to Gemini...')
        } else {
          console.error('Groq Quiz call failed:', groqErr)
        }
      }
    }

    // ── 2️⃣ Fall back to Gemini (with 8s timeout) ───────────────────────────
    if (geminiApiKey) {
      const maxRetries = 2
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5, responseMimeType: 'application/json' },
              }),
            }
          )
          clearTimeout(timeoutId)

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json()
            const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
            const quiz = processQuizResponse(text)
            if (quiz) {
              console.log('Quiz generated via Gemini ✅')
              return NextResponse.json({ quiz })
            }
            break
          } else if (geminiRes.status === 429 || geminiRes.status === 503) {
            console.warn(`Gemini Quiz ${geminiRes.status}, retrying (attempt ${attempt + 1}/${maxRetries})`)
            if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1000))
          } else {
            console.error('Gemini Quiz error:', geminiRes.status, await geminiRes.text())
            break
          }
        } catch (geminiErr: any) {
          clearTimeout(timeoutId)
          if (geminiErr.name === 'AbortError') {
            console.warn(`Gemini Quiz timed out (attempt ${attempt + 1}/${maxRetries})`)
            if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 500))
          } else {
            console.error('Gemini Quiz call failed:', geminiErr)
            break
          }
        }
      }
    }

    // ── 3️⃣ Fall back to OpenAI if available ────────────────────────────────
    if (openaiApiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiApiKey}` },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1200,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        const text = data?.choices?.[0]?.message?.content || ''
        const quiz = processQuizResponse(text)
        if (quiz) return NextResponse.json({ quiz })
      }
    }

    // ── 4️⃣ Last resort: demo fallback ───────────────────────────────────────
    console.warn('All APIs failed, returning fallback quiz')
    return NextResponse.json({ quiz: generateFallbackQuiz(context) })
  } catch (error) {
    console.error('Quiz generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateFallbackQuiz(context: string) {
  const words = context.split(/\s+/)
  const topicWords = words.slice(0, 6).join(' ')
  return {
    questions: [
      {
        question: `Based on the recent segment about "${topicWords}...", which statement best describes the main topic?`,
        options: [
          'It introduced a new theoretical framework for the subject',
          'It provided practical examples of the core concept',
          'It compared different approaches to the problem',
          'It reviewed prerequisite knowledge for the next section',
        ],
        correct: 1,
        explanation: 'The instructor provided practical examples to illustrate the core concept being discussed.',
      },
      {
        question: 'What was the primary purpose of this segment?',
        options: [
          'To define key terminology',
          'To demonstrate a process step by step',
          'To summarize the main findings',
          'To compare two competing theories',
        ],
        correct: 1,
        explanation: 'This segment walked through the process to help students understand the methodology.',
      },
      {
        question: 'Which approach was emphasized in the recent discussion?',
        options: [
          'A theoretical and abstract approach',
          'A hands-on, example-driven approach',
          'A historical perspective',
          'A purely mathematical approach',
        ],
        correct: 1,
        explanation: 'The discussion favored a practical, example-driven approach to explain the concept.',
      },
    ],
  }
}
