import { NextRequest } from 'next/server'
import { AgentRegistry, ChatSession, MemorySessionStore } from '@genui-a3/core'
import { provider } from '../../lib/providers'
import { greetingAgent, State } from '../../agents/greeting'
import { ageAgent } from '../../agents/age'

// Guard: agent may already be registered by the non-streaming route
const registry = AgentRegistry.getInstance<State>()
if (!registry.has('greeting')) {
  registry.register(greetingAgent)
}
if (!registry.has('age')) {
  registry.register(ageAgent)
}

const store = new MemorySessionStore<State>()

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { message?: string; sessionId?: string }
  const { message, sessionId = 'demo-stream-session' } = body

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const session = new ChatSession<State>({
    sessionId,
    store,
    initialAgentId: 'greeting',
    initialState: { userName: undefined },
    provider,
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of session.send({ message, stream: true })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (error) {
        const errorEvent = {
          type: 'error',
          error: { message: String(error) },
          agentId: 'unknown',
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
