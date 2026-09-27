import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { context, language = 'en' } = await req.json()

    if (!context || context.trim().length < 5) {
      return NextResponse.json({
        summary: {
          summary: 'Start watching the lecture video to receive real-time AI summaries and explanations whenever you feel confused.',
          topic: 'Lecture Overview',
        },
      })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!groqApiKey && !geminiApiKey && !openaiApiKey) {
      return NextResponse.json({
        summary: {
          summary: 'The instructor has been explaining a core concept with practical examples, building on previously introduced foundations.',
          topic: 'Core Concept Explanation',
        },
      })
    }

    const prompt = `You are an educational assistant. A student seems confused while watching a lecture. Based on the following transcript excerpt from the last 2 minutes, provide a clear, concise explanation to help them understand.

CRITICAL LANGUAGE RULE: Even if the input transcript is in Devanagari Hindi script (e.g., 'इज़ कंटीन्यूअस इंटीग्रेशन'), you MUST NEVER output Devanagari script (अ-ज्ञ). Always write all quiz questions, options, summaries, and recaps in clear English or natural Hinglish (Roman/Latin alphabet only), and always use proper English spellings for all English and technical words (e.g., 'continuous integration', 'practical example', 'e-commerce application').

TRANSCRIPT:
"""
${context}
"""

You MUST respond with ONLY valid JSON in this exact format, no other text:
{
  "summary": "A clear 2-3 sentence explanation of what was just discussed, written in simple language to help a confused student understand the concept.",
  "topic": "Short topic name (3-5 words)"
}

Make it simple, supportive, and helpful. Use plain language.`

    const parseSummary = (text: string) => {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      try { return JSON.parse(jsonMatch[0]) } catch { return null }
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
            temperature: 0.4,
            max_tokens: 800,
          }),
        })
        clearTimeout(timeoutId)

        if (groqRes.ok) {
          const groqData = await groqRes.json()
          const text = groqData?.choices?.[0]?.message?.content || ''
          const summary = parseSummary(text)
          if (summary) {
            console.log('Summary generated via Groq ✅')
            return NextResponse.json({ summary })
          }
        } else {
          console.warn('Groq Summary error:', groqRes.status, await groqRes.text())
        }
      } catch (groqErr: any) {
        if (groqErr.name === 'AbortError') {
          console.warn('Groq Summary timed out, falling back to Gemini...')
        } else {
          console.error('Groq Summary call failed:', groqErr)
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
                generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
              }),
            }
          )
          clearTimeout(timeoutId)

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json()
            const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
            const summary = parseSummary(text)
            if (summary) {
              console.log('Summary generated via Gemini ✅')
              return NextResponse.json({ summary })
            }
            break
          } else if (geminiRes.status === 429 || geminiRes.status === 503) {
            console.warn(`Gemini Summary ${geminiRes.status}, retrying (attempt ${attempt + 1}/${maxRetries})`)
            if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1000))
          } else {
            console.error('Gemini API error:', geminiRes.status, await geminiRes.text())
            break
          }
        } catch (geminiErr: any) {
          clearTimeout(timeoutId)
          if (geminiErr.name === 'AbortError') {
            console.warn(`Gemini Summary timed out (attempt ${attempt + 1}/${maxRetries})`)
            if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 500))
          } else {
            console.error('Gemini API call failed:', geminiErr)
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
          temperature: 0.5,
          max_tokens: 400,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        const text = data?.choices?.[0]?.message?.content || ''
        const summary = parseSummary(text)
        if (summary) return NextResponse.json({ summary })
      }
    }

    // ── 4️⃣ Last resort fallback ─────────────────────────────────────────────
    console.warn('All APIs failed, returning fallback summary')
    return NextResponse.json({
      summary: {
        summary: 'The instructor was explaining a complex topic. Try replaying the last few minutes or asking for more details.',
        topic: 'Recent Discussion',
      },
    })
  } catch (error) {
    console.error('Summary generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
