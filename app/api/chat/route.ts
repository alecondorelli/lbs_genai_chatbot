import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { SYSTEM_PROMPT } from '@/lib/constants'
import { checkContentFilter, INPUT_BLOCKED_MESSAGE } from '@/lib/filters'

// Lazy SDK clients — avoid instantiating at module scope so Vercel builds
// don't crash when env vars are absent during static page collection.
let _anthropic: Anthropic | null = null
let _openai: OpenAI | null = null
let _google: GoogleGenerativeAI | null = null

function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}
function getGoogle() {
  if (!_google) _google = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  return _google
}

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

interface FileAttachment {
  base64: string
  mimeType: string
}

// Build Anthropic message content blocks (supports images + PDFs)
function buildAnthropicMessages(messages: ChatMessage[], file?: FileAttachment) {
  return messages.map((m, i) => {
    const isLast = i === messages.length - 1
    if (isLast && m.role === 'user' && file) {
      const isPdf = file.mimeType === 'application/pdf'
      const fileBlock = isPdf
        ? {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: file.base64,
            },
          }
        : {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: file.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: file.base64,
            },
          }
      const defaultPrompt = isPdf ? 'What is in this PDF?' : 'What do you see in this image?'
      const content = [
        fileBlock,
        { type: 'text' as const, text: m.content || defaultPrompt },
      ]
      return { role: m.role as 'user' | 'assistant', content }
    }
    return { role: m.role as 'user' | 'assistant', content: m.content }
  })
}

function streamAnthropic(messages: ChatMessage[], file?: FileAttachment): ReadableStream {
  const encoder = new TextEncoder()
  const stream = getAnthropic().messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: buildAnthropicMessages(messages, file),
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
      } catch (error: unknown) {
        const err = error as Error & { status?: number; message?: string }
        console.error('Anthropic stream error:', { message: err.message, status: err.status, stack: err.stack })
        controller.error(error)
      }
    },
  })
}

function streamOpenAI(messages: ChatMessage[], file?: FileAttachment): ReadableStream {
  const encoder = new TextEncoder()
  // OpenAI doesn't support PDF uploads — only pass image attachments
  const image = file && file.mimeType !== 'application/pdf' ? file : undefined

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

        const stream = await getOpenAI().chat.completions.create({
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
      } catch (error: unknown) {
        const err = error as Error & { status?: number; message?: string }
        console.error('OpenAI stream error:', { message: err.message, status: err.status, stack: err.stack })
        controller.error(error)
      }
    },
  })
}

function streamGemini(messages: ChatMessage[], file?: FileAttachment): ReadableStream {
  const encoder = new TextEncoder()
  const model = getGoogle().getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  const geminiHistory = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const lastMessage = messages[messages.length - 1]

  // Build parts for the last message, optionally including image or PDF
  const lastParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
  if (file) {
    lastParts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } })
  }
  const isPdf = file?.mimeType === 'application/pdf'
  const defaultPrompt = isPdf ? 'What is in this PDF?' : 'What do you see in this image?'
  lastParts.push({ text: lastMessage.content || defaultPrompt })

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
      } catch (error: unknown) {
        const err = error as Error & { status?: number; message?: string }
        console.error('Gemini stream error:', { message: err.message, status: err.status, stack: err.stack })
        controller.error(error)
      }
    },
  })
}

// Allow up to 60 seconds for AI responses on Vercel (default is 10s)
export const maxDuration = 60

/**
 * Wraps a readable SSE stream to pass chunks through immediately while
 * accumulating the full response for a content-filter check. If the
 * complete response is flagged, the server logs a warning; the frontend
 * output filter handles replacing the message for the user.
 *
 * Previous implementation buffered ALL chunks before sending anything,
 * which caused Vercel serverless functions to timeout.
 */
function filterOutputStream(source: ReadableStream): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const reader = source.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Pass through to client immediately (no buffering)
          controller.enqueue(value)

          // Also accumulate text for post-stream content check
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try { accumulated += JSON.parse(data) } catch { accumulated += data }
            }
          }
        }

        // Log if the output would have been filtered
        // (the frontend output filter will handle replacing the message)
        if (checkContentFilter(accumulated)) {
          console.warn('[chat] Output filter: response contained flagged content')
        }

        controller.close()
      } catch (error: unknown) {
        const err = error as Error & { message?: string }
        console.error('filterOutputStream error:', err.message, err)
        controller.error(error)
      }
    },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages, model, image, mimeType } = body

    // --- Debug logging ---
    console.log('[chat] Request received:', {
      model,
      messageCount: messages?.length,
      hasImage: !!image,
      mimeType: mimeType || 'none',
      imageBase64Length: image ? image.length : 0,
    })

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

    const attachment: FileAttachment | undefined =
      image && mimeType ? { base64: image, mimeType } : undefined

    console.log('[chat] Routing to:', selectedModel, '| attachment:', attachment ? `${attachment.mimeType} (${attachment.base64.length} chars)` : 'none')

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
