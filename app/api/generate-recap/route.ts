import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { context, language = 'en' } = await req.json()

    const defaultRecap = {
      topic: 'Lecture Catch-up & Context',
      bullets: [
        'The instructor was introducing core concepts and key lecture points before the break.',
        'Core principles and mechanisms were being established with direct examples.',
        'You are now set to resume and follow along with the upcoming explanations.',
      ],
    }

    if (!context || context.trim().length < 5) {
      return NextResponse.json({ recap: defaultRecap })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!groqApiKey && !geminiApiKey && !openaiApiKey) {
      return NextResponse.json({ recap: defaultRecap })
    }

    const prompt = `You are an educational AI assistant for Smart-Lecture. The student just took a short break to recharge after feeling drowsy.
Based on the following transcript excerpt from the last 2-3 minutes of the video, provide a crisp post-break recap with exactly 3 bullet points to help them quickly recall where they left off and get back in the flow before resuming the video.

CRITICAL LANGUAGE RULE: Even if the input transcript is in Devanagari Hindi script (e.g., 'इज़ कंटीन्यूअस इंटीग्रेशन'), you MUST NEVER output Devanagari script (अ-ज्ञ). Always write all quiz questions, options, summaries, and recaps in clear English or natural Hinglish (Roman/Latin alphabet only), and always use proper English spellings for all English and technical words (e.g., 'continuous integration', 'practical example', 'e-commerce application').

TRANSCRIPT:
"""
${context}
"""

You MUST respond with ONLY valid JSON in this exact format, no other text or explanation:
{
  "topic": "Short Topic Title (3-6 words)",
  "bullets": [
    "First concise recap bullet point about what was discussed right before the break",
    "Second concise recap bullet point highlighting a key insight or definition",
    "Third concise recap bullet point on what to pay attention to next"
  ]
}

Make each bullet point clear, informative, and engaging. Return exactly 3 bullets.`

    const parseRecap = (text: string) => {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.bullets && Array.isArray(parsed.bullets) && parsed.bullets.length > 0) {
          return {
            topic: parsed.topic || 'Lecture Recap',
            bullets: parsed.bullets.slice(0, 3),
          }
        }
        return null
      } catch {
        return null
      }
    }

    // ── 1️⃣ Try GROQ first ───────────────────────────────────────────────────
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
          const recap = parseRecap(text)
          if (recap) {
            console.log('Recap generated via Groq ✅')
            return NextResponse.json({ recap })
          }
        } else {
          console.warn('Groq Recap error:', groqRes.status, await groqRes.text())
        }
      } catch (groqErr: any) {
        if (groqErr.name === 'AbortError') {
          console.warn('Groq Recap timed out, falling back to Gemini...')
        } else {
          console.error('Groq Recap call failed:', groqErr)
        }
      }
    }

    // ── 2️⃣ Fall back to Gemini ─────────────────────────────────────────────
    if (geminiApiKey) {
      const maxRetries = 2
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.4,
                  maxOutputTokens: 800,
                  responseMimeType: 'application/json',
                },
              }),
            }
          )
          clearTimeout(timeoutId)

          if (geminiRes.status === 429 || geminiRes.status === 503) {
            if (attempt < maxRetries - 1) {
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
              continue
            }
          }

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json()
            const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
            const recap = parseRecap(text)
            if (recap) {
              console.log('Recap generated via Gemini ✅')
              return NextResponse.json({ recap })
            }
          }
        } catch (geminiErr: any) {
          clearTimeout(timeoutId)
          if (attempt === maxRetries - 1) {
            console.error('Gemini Recap failed:', geminiErr)
          }
        }
      }
    }

    // ── 3️⃣ Fallback ─────────────────────────────────────────────────────────
    return NextResponse.json({ recap: defaultRecap })
  } catch (error: any) {
    console.error('Generate recap route error:', error)
    return NextResponse.json(
      {
        recap: {
          topic: 'Lecture Catch-up',
          bullets: [
            'The instructor discussed the latest concepts prior to your break.',
            'Review key points noted on screen before resuming.',
            'Click below when you are ready to continue learning.',
          ],
        },
      },
      { status: 200 }
    )
  }
}
