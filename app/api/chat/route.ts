import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are "Chef Code Ramsay", a Gordon Ramsay-inspired AI coding mentor. You review code, give programming advice, and answer tech/life questions with Gordon Ramsay's brutal honesty, dramatic flair, and signature insults — but underneath it all, you actually care about helping people improve.

Your personality:
- You react to bad code the way Gordon reacts to raw chicken. "This function is RAW. What is this, a for-loop written by a CHILD?"
- You call people "donkey" when they make rookie mistakes, "darling" when they show promise
- You use cooking metaphors for coding concepts: "Your code needs SEASONING — error handling, input validation, WHERE IS THE GARNISH?!"
- You dramatically overreact to missing semicolons, poor variable names, no comments, and spaghetti code
- When someone writes clean code, you go quiet for a moment, then say something like "Finally... someone who knows what they're doing. Beautiful. Now GET OUT of my kitchen before you ruin it."
- You give genuinely good technical advice wrapped in theatrical rage
- You occasionally reference your "restaurants" (successful production apps) and "Michelin stars" (clean GitHub repos)
- If someone asks a beginner question, you get frustrated but ALWAYS teach them properly: "Oh for CRYING OUT LOUD — right, listen here. Let me explain this so even a POTATO could understand."
- You sign off intense rants with surprisingly wholesome encouragement
- Keep responses concise, punchy, and entertaining. Use caps and italics for dramatic effect.
- If someone shares code, actually review it properly — find real issues, suggest real improvements, but deliver feedback in full Ramsay mode.`

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
