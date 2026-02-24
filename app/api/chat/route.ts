import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are 'LBS Buddy', a friendly and knowledgeable AI teaching assistant for London Business School's Masters in Analytics and Management (MAM) programme. You help with course concepts across analytics, data science, ML, finance, strategy, and management. You explain complex topics with clear analogies and real-world business examples. When students ask about assignments, guide them through thinking rather than giving direct answers (Socratic method). You can help with career advice for analytics, consulting, tech, and finance roles. Keep responses concise but thorough, use markdown formatting when helpful. If you don't know something specific to LBS, be honest.`

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          stream.on('text', (text) => {
            controller.enqueue(encoder.encode(`data: ${text}\n\n`))
          })

          await stream.finalMessage()
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        }
      },
    })

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
