import { NextRequest } from 'next/server'
import { getChatSessionInstance } from '@agents'
import { SESSION_IDS } from '@constants/chat'
import { AgentRegistry } from '@genui-a3/a3'
import type { State } from '@agents/state'
import { onboardingAgent } from '@agents/onboarding'
import { initRegistry } from '@agents/registry'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { message?: string; sessionId?: string }
  const { message, sessionId = 'demo-stream-session' } = body

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let session = getChatSessionInstance({ sessionId })
  initRegistry()
  if (sessionId === SESSION_IDS.ONBOARDING) {
    const registry = AgentRegistry.getInstance<State>()
    registry.register(onboardingAgent)
    session = getChatSessionInstance({ sessionId, initialAgentId: onboardingAgent.id })
  }

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
