import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { SYSTEM_PROMPT } from '@/lib/constants'
import { checkContentFilter, INPUT_BLOCKED_MESSAGE, OUTPUT_BLOCKED_MESSAGE } from '@/lib/filters'

// SDK clients
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const google = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

const ALLOWED_MODELS = [
  'anthropic/claude-sonnet',
  'google/gemini-flash',
  'openai/gpt-4o-mini',
] as const

type ModelId = (typeof ALLOWED_MODELS)[number]

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ImageAttachment {
  base64: string
  mimeType: string
}

// Build Anthropic message content blocks
function buildAnthropicMessages(messages: ChatMessage[], image?: ImageAttachment) {
  return messages.map((m, i) => {
    const isLast = i === messages.length - 1
    if (isLast && m.role === 'user' && image) {
      const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: image.base64,
          },
        },
        { type: 'text' as const, text: m.content || 'What do you see in this image?' },
      ]
      return { role: m.role as 'user' | 'assistant', content }
    }
    return { role: m.role as 'user' | 'assistant', content: m.content }
  })
}

function streamAnthropic(messages: ChatMessage[], image?: ImageAttachment): ReadableStream {
  const encoder = new TextEncoder()
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: buildAnthropicMessages(messages, image),
  })

  return new ReadableStream({
    async start(controller) {
      try {
        stream.on('text', (text) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`))
        })
        await stream.finalMessage()
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        console.error('Anthropic stream error:', error)
        controller.error(error)
      }
    },
  })
}

function streamOpenAI(messages: ChatMessage[], image?: ImageAttachment): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const oaiMessages: OpenAI.ChatCompletionMessageParam[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.map((m, i) => {
            const isLast = i === messages.length - 1
            if (isLast && m.role === 'user' && image) {
              return {
                role: 'user' as const,
                content: [
                  {
                    type: 'image_url' as const,
                    image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
                  },
                  { type: 'text' as const, text: m.content || 'What do you see in this image?' },
                ],
              }
            }
            return { role: m.role as 'user' | 'assistant', content: m.content }
          }),
        ]

        const stream = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 1024,
          stream: true,
          messages: oaiMessages,
        })

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`))
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        console.error('OpenAI stream error:', error)
        controller.error(error)
      }
    },
  })
}

function streamGemini(messages: ChatMessage[], image?: ImageAttachment): ReadableStream {
  const encoder = new TextEncoder()
  const model = google.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  const geminiHistory = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const lastMessage = messages[messages.length - 1]

  // Build parts for the last message, optionally including the image
  const lastParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
  if (image) {
    lastParts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
  }
  lastParts.push({ text: lastMessage.content || 'What do you see in this image?' })

  return new ReadableStream({
    async start(controller) {
      try {
        const chat = model.startChat({ history: geminiHistory })
        const result = await chat.sendMessageStream(lastParts)

        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`))
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        console.error('Gemini stream error:', error)
        controller.error(error)
      }
    },
  })
}

/**
 * Wraps a readable SSE stream to buffer the full response and check it
 * against the content filter once streaming completes. If flagged, the
 * buffered tokens are discarded and a single safety notice is sent instead.
 */
function filterOutputStream(source: ReadableStream): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      const reader = source.getReader()
      const decoder = new TextDecoder()
      const bufferedChunks: Uint8Array[] = []
      let accumulated = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Collect raw bytes so we can replay them if clean
          bufferedChunks.push(value)

          // Also parse out the text tokens to build the accumulated string
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try { accumulated += JSON.parse(data) } catch { accumulated += data }
            }
          }
        }

        // Check accumulated output
        if (checkContentFilter(accumulated)) {
          // Send the safety warning instead of the real content
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(OUTPUT_BLOCKED_MESSAGE)}\n\n`))
        } else {
          // Replay all buffered chunks as-is
          for (const chunk of bufferedChunks) {
            controller.enqueue(chunk)
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

export async function POST(req: Request) {
  try {
    const { messages, model, image, mimeType } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // --- Backend input filter: reject flagged messages before calling any AI ---
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user' && checkContentFilter(lastMessage.content)) {
      const encoder = new TextEncoder()
      const blocked = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(INPUT_BLOCKED_MESSAGE)}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(blocked, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    const selectedModel: ModelId = (ALLOWED_MODELS as readonly string[]).includes(model)
      ? (model as ModelId)
      : 'anthropic/claude-sonnet'

    const attachment: ImageAttachment | undefined =
      image && mimeType ? { base64: image, mimeType } : undefined

    let readable: ReadableStream

    switch (selectedModel) {
      case 'anthropic/claude-sonnet':
        readable = streamAnthropic(messages, attachment)
        break
      case 'openai/gpt-4o-mini':
        readable = streamOpenAI(messages, attachment)
        break
      case 'google/gemini-flash':
        readable = streamGemini(messages, attachment)
        break
      default:
        readable = streamAnthropic(messages, attachment)
        break
    }

    // --- Backend output filter: wrap the stream to check the full response ---
    const filtered = filterOutputStream(readable)

    return new Response(filtered, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
