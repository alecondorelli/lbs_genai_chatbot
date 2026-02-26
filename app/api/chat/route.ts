import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { SYSTEM_PROMPT } from '@/lib/constants'

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

function streamAnthropic(messages: ChatMessage[]): ReadableStream {
  const encoder = new TextEncoder()
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  return new ReadableStream({
    async start(controller) {
      try {
        stream.on('text', (text) => {
          controller.enqueue(encoder.encode(`data: ${text}\n\n`))
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

function streamOpenAI(messages: ChatMessage[]): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 1024,
          stream: true,
          messages: [
            { role: 'system' as const, content: SYSTEM_PROMPT },
            ...messages.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          ],
        })

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content
          if (text) {
            controller.enqueue(encoder.encode(`data: ${text}\n\n`))
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

function streamGemini(messages: ChatMessage[]): ReadableStream {
  const encoder = new TextEncoder()
  const model = google.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  const geminiHistory = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const lastMessage = messages[messages.length - 1].content

  return new ReadableStream({
    async start(controller) {
      try {
        const chat = model.startChat({ history: geminiHistory })
        const result = await chat.sendMessageStream(lastMessage)

        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            controller.enqueue(encoder.encode(`data: ${text}\n\n`))
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

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const selectedModel: ModelId = (ALLOWED_MODELS as readonly string[]).includes(model)
      ? (model as ModelId)
      : 'anthropic/claude-sonnet'

    let readable: ReadableStream

    switch (selectedModel) {
      case 'anthropic/claude-sonnet':
        readable = streamAnthropic(messages)
        break
      case 'openai/gpt-4o-mini':
        readable = streamOpenAI(messages)
        break
      case 'google/gemini-flash':
        readable = streamGemini(messages)
        break
    }

    return new Response(readable, {
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
