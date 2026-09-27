import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json()

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
    }

    const fullText = transcript
      .map((e: { text: string }) => e.text)
      .join(' ')
      .trim()

    if (fullText.length < 20) {
      return NextResponse.json({ error: 'Transcript too short to summarize' }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!groqApiKey && !geminiApiKey && !openaiApiKey) {
      return NextResponse.json({ fullSummary: getFallbackSummary() })
    }

    // Truncate transcript if too long for the model context window
    const maxChars = 30000
    const truncated = fullText.length > maxChars ? fullText.slice(0, maxChars) + '...' : fullText

    const prompt = `You are an expert educational summarizer. Given the full transcript of a lecture, produce a structured summary that helps a student review the material.

CRITICAL LANGUAGE RULE: Even if the input transcript is in Devanagari Hindi script (e.g., 'इज़ कंटीन्यूअस इंटीग्रेशन'), you MUST NEVER output Devanagari script (अ-ज्ञ). Always write all quiz questions, options, summaries, and recaps in clear English or natural Hinglish (Roman/Latin alphabet only), and always use proper English spellings for all English and technical words (e.g., 'continuous integration', 'practical example', 'e-commerce application').

TRANSCRIPT:
"""
${truncated}
"""

You MUST respond with ONLY valid JSON in this exact format, no other text:
{
  "title": "Descriptive lecture title (5-10 words)",
  "overview": "A 2-3 sentence high-level overview of the entire lecture.",
  "sections": [
    {
      "heading": "Section heading",
      "content": "2-3 sentence summary of this section"
    }
  ],
  "keyTakeaways": [
    "First key takeaway",
    "Second key takeaway",
    "Third key takeaway"
  ]
}

Create 3-5 sections based on the natural topic flow. Keep language clear and concise.`

    const parseSummary = (text: string) => {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      try { return JSON.parse(jsonMatch[0]) } catch { return null }
    }

    // ── 1️⃣ Try GROQ first (fast, 14,400 req/day free) ──────────────────────
    if (groqApiKey) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s for full summary (longer transcript)
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
            temperature: 0.4,
            max_tokens: 3000,
          }),
        })
        clearTimeout(timeoutId)

        if (groqRes.ok) {
          const groqData = await groqRes.json()
          const text = groqData?.choices?.[0]?.message?.content || ''
          const fullSummary = parseSummary(text)
          if (fullSummary) {
            console.log('Full summary generated via Groq ✅')
            return NextResponse.json({ fullSummary })
          }
        } else {
          console.warn('Groq Summarize error:', groqRes.status, await groqRes.text())
        }
      } catch (groqErr: any) {
        if (groqErr.name === 'AbortError') {
          console.warn('Groq Summarize timed out, falling back to Gemini...')
        } else {
          console.error('Groq Summarize call failed:', groqErr)
        }
      }
    }

    // ── 2️⃣ Fall back to Gemini (with 15s timeout for full transcript) ───────
    if (geminiApiKey) {
      const maxRetries = 2
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
              }),
            }
          )
          clearTimeout(timeoutId)

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json()
            const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
            const fullSummary = parseSummary(text)
            if (fullSummary) {
              console.log('Full summary generated via Gemini ✅')
              return NextResponse.json({ fullSummary })
            }
            break
          } else if (geminiRes.status === 429 || geminiRes.status === 503) {
            console.warn(`Gemini Summarize ${geminiRes.status}, retrying (attempt ${attempt + 1}/${maxRetries})`)
            if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1000))
          } else {
            console.error('Gemini summarize error:', geminiRes.status, await geminiRes.text())
            break
          }
        } catch (geminiErr: any) {
          clearTimeout(timeoutId)
          if (geminiErr.name === 'AbortError') {
            console.warn(`Gemini Summarize timed out (attempt ${attempt + 1}/${maxRetries})`)
            if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 500))
          } else {
            console.error('Gemini Summarize call failed:', geminiErr)
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
          temperature: 0.4,
          max_tokens: 2000,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        const text = data?.choices?.[0]?.message?.content || ''
        const fullSummary = parseSummary(text)
        if (fullSummary) return NextResponse.json({ fullSummary })
      }
    }

    console.warn('All APIs failed for full summary')
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  } catch (error) {
    console.error('Full summarization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getFallbackSummary() {
  return {
    title: 'Lecture Summary',
    overview: 'This lecture covered several important topics including foundational concepts, practical examples, and key takeaways.',
    sections: [
      { heading: 'Introduction', content: 'The lecture began with an overview of the subject matter and its relevance.' },
      { heading: 'Core Concepts', content: 'Key theories and frameworks were introduced with detailed explanations.' },
      { heading: 'Conclusion', content: 'The session wrapped up with a review of critical points.' },
    ],
    keyTakeaways: [
      'Understand the fundamental principles discussed',
      'Practice applying concepts to real-world scenarios',
      'Review supplementary materials for deeper understanding',
    ],
  }
}
