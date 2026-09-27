import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { videoId } = await req.json()

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId' },
        { status: 400 }
      )
    }

    // Step 0: Try Supadata API if SUPADATA_API_KEY is configured
    const supadataApiKey = process.env.SUPADATA_API_KEY
    if (supadataApiKey) {
      try {
        const supaRes = await fetch(
          `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}&text=false`,
          {
            headers: {
              'x-api-key': supadataApiKey,
            },
          }
        )

        if (supaRes.ok) {
          const supaData = await supaRes.json()
          const rawItems = supaData.content || supaData.transcript || supaData.events || []
          if (Array.isArray(rawItems) && rawItems.length > 0) {
            const transcript = rawItems.map((item: any) => {
              const rawStart = item.offset !== undefined ? item.offset : (item.start ?? item.tStartMs ?? 0)
              const rawDuration = item.duration !== undefined ? item.duration : (item.dDurationMs ?? 4000)

              let start = Number(rawStart)
              let duration = Number(rawDuration)

              // Supadata and YouTube API timestamps are in milliseconds (e.g. 560, 2850, 18300)
              if (item.offset !== undefined || item.tStartMs !== undefined || start > 300) {
                start = start / 1000
                duration = duration / 1000
              }

              start = Math.round(start * 100) / 100
              duration = Math.round((duration > 0 ? duration : 4) * 100) / 100

              const text = (item.text || item.content || '').replace(/\n/g, ' ').trim()
              return {
                start: isNaN(start) ? 0 : start,
                duration: isNaN(duration) ? 4 : duration,
                text: text || '[Inaudible]',
              }
            }).filter((item: { text: string }) => item.text.length > 0)

            if (transcript.length > 0) {
              return NextResponse.json({
                transcript,
                language: supaData.lang || supaData.language || 'en',
                source: 'supadata',
              })
            }
          }
        } else {
          console.warn('Supadata API responded with status:', supaRes.status)
        }
      } catch (supaErr) {
        console.error('Supadata API fetch error:', supaErr)
      }
    }

    // Step 1: Use YouTube's Innertube player API to get caption track URLs
    let captionUrl: string | null = null
    let detectedLanguage: string = 'en'
    try {
      const playerRes = await fetch(
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20250301.00.00',
              },
            },
            videoId,
          }),
        }
      )

      if (playerRes.ok) {
        const playerData = await playerRes.json()
        const captionTracks =
          playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

        if (captionTracks && captionTracks.length > 0) {
          // Prefer English, fallback to first track
          const englishTrack = captionTracks.find(
            (t: { languageCode: string }) =>
              t.languageCode === 'en' || t.languageCode === 'en-US'
          )
          const track = englishTrack || captionTracks[0]
          if (track?.baseUrl) {
            captionUrl = track.baseUrl
            detectedLanguage = track.languageCode || 'en'
          }
        }
      }
    } catch (e) {
      console.error('Innertube player API failed:', e)
    }

    // Step 2: Fetch the actual timed-text captions in JSON3 format
    if (captionUrl) {
      try {
        const timedTextRes = await fetch(captionUrl + '&fmt=json3')
        if (timedTextRes.ok) {
          const timedTextData = await timedTextRes.json()
          const events = timedTextData.events || []
          const transcript = events
            .filter(
              (e: { segs?: unknown[] }) => e.segs && e.segs.length > 0
            )
            .map(
              (e: {
                tStartMs: number
                dDurationMs?: number
                segs: Array<{ utf8: string }>
              }) => {
                const start = e.tStartMs / 1000
                const duration = (e.dDurationMs || 5000) / 1000
                const text = e.segs
                  .map((s: { utf8: string }) => s.utf8)
                  .join('')
                  .replace(/\n/g, ' ')
                  .trim()

                // Log invalid entries for debugging
                if (isNaN(start) || isNaN(duration) || !text) {
                  console.warn('Invalid transcript entry detected:', { start, duration, text })
                }

                return {
                  start: isNaN(start) ? 0 : start,
                  duration: isNaN(duration) ? 5 : duration,
                  text: text || '[Inaudible]',
                }
              }
            )
            .filter((e: { text: string }) => e.text.length > 0)

          if (transcript.length > 0) {
            return NextResponse.json({ 
              transcript,
              language: detectedLanguage 
            })
          }
        }
      } catch (e) {
        console.error('Timed text fetch failed:', e)
      }
    }

    // Step 3: Fallback — try scraping the watch page for captionTracks
    try {
      const pageRes = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }
      )

      if (pageRes.ok) {
        const html = await pageRes.text()
        const match =
          html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/) ||
          html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])/)

        if (match) {
          try {
            const tracks = JSON.parse(match[1])
            const englishTrack =
              tracks.find(
                (t: { languageCode: string }) => t.languageCode === 'en'
              ) || tracks[0]

            if (englishTrack?.baseUrl) {
              const timedTextRes = await fetch(
                englishTrack.baseUrl + '&fmt=json3'
              )
              if (timedTextRes.ok) {
                const timedTextData = await timedTextRes.json()
                const events = timedTextData.events || []
                const transcript = events
                  .filter(
                    (e: { segs?: unknown[] }) => e.segs && e.segs.length > 0
                  )
                  .map(
                    (e: {
                      tStartMs: number
                      dDurationMs?: number
                      segs: Array<{ utf8: string }>
                    }) => {
                      const start = e.tStartMs / 1000
                      const duration = (e.dDurationMs || 5000) / 1000
                      const text = e.segs
                        .map((s: { utf8: string }) => s.utf8)
                        .join('')
                        .replace(/\n/g, ' ')
                        .trim()

                      return {
                        start: isNaN(start) ? 0 : start,
                        duration: isNaN(duration) ? 5 : duration,
                        text: text || '[Inaudible]',
                      }
                    }
                  )
                  .filter((e: { text: string }) => e.text.length > 0)

                if (transcript.length > 0) {
                  return NextResponse.json({ transcript })
                }
              }
            }
          } catch (jsonErr) {
            console.warn('Failed to parse captionTracks json:', jsonErr)
          }
        }
      }
    } catch (e) {
      console.error('Watch page scrape failed:', e)
    }

    // Step 4: All methods failed — return demo transcript
    const demoTranscript = generateDemoTranscript()
    return NextResponse.json({
      transcript: demoTranscript,
      isDemo: true,
    })
  } catch (error) {
    console.error('Transcript fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    )
  }
}

function generateDemoTranscript() {
  const topics = [
    'Welcome everyone to today\'s lecture on machine learning fundamentals.',
    'Let\'s start by understanding what supervised learning means.',
    'In supervised learning, we have labeled training data that guides the model.',
    'The model learns a mapping from inputs to outputs based on example pairs.',
    'Think of it like a teacher showing a student the correct answers during practice.',
    'Now, the key metric we use to evaluate models is called the loss function.',
    'The loss function measures how far the model\'s predictions are from actual values.',
    'Common loss functions include mean squared error for regression tasks.',
    'For classification, we typically use cross-entropy loss.',
    'Let me explain gradient descent, the optimization algorithm that minimizes loss.',
    'Gradient descent works by computing the derivative of the loss with respect to weights.',
    'We then update weights in the direction that reduces the loss.',
    'The learning rate controls how big each update step is.',
    'A learning rate too high causes the model to overshoot the minimum.',
    'A learning rate too low makes training extremely slow.',
    'This brings us to the concept of overfitting versus underfitting.',
    'Overfitting occurs when the model memorizes training data but fails on new data.',
    'Underfitting means the model is too simple to capture the underlying pattern.',
    'Regularization techniques help prevent overfitting.',
    'L2 regularization adds a penalty proportional to the square of weights.',
    'Dropout randomly deactivates neurons during training to prevent co-adaptation.',
    'Now let\'s discuss neural network architectures in more detail.',
    'A neural network consists of layers: input, hidden, and output.',
    'Each neuron applies a weighted sum followed by an activation function.',
    'Popular activation functions include ReLU, sigmoid, and tanh.',
    'ReLU is most commonly used because it avoids the vanishing gradient problem.',
    'Deep networks with many layers can learn hierarchical representations.',
    'Convolutional neural networks are specialized for image processing tasks.',
    'Recurrent neural networks handle sequential data like text and time series.',
    'Transformers have revolutionized natural language processing.',
    'The attention mechanism allows models to focus on relevant parts of the input.',
    'Self-attention computes relationships between all positions in a sequence.',
    'This parallel processing makes transformers much faster to train than RNNs.',
    'Pre-trained models like BERT and GPT leverage massive datasets.',
    'Transfer learning allows us to fine-tune these models for specific tasks.',
    'This approach dramatically reduces the amount of task-specific data needed.',
    'Let\'s now look at some practical applications of these concepts.',
    'Image classification can identify objects in photographs with high accuracy.',
    'Natural language processing enables chatbots and translation systems.',
    'Recommendation systems use collaborative filtering and deep learning.',
    'In summary, machine learning provides powerful tools for pattern recognition.',
    'The key is choosing the right architecture and training strategy for your problem.',
    'Next week we will dive into hands-on coding exercises.',
    'Please review the slides and complete the homework assignment.',
    'Thank you for attending. See you in the next lecture.',
  ]

  return topics.map((text, i) => ({
    start: i * 15,
    duration: 14,
    text,
  }))
}
