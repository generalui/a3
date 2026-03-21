/**
 * Streaming (SSE) chat endpoint.
 * Used by the Steadfast Plumbing example and the onboarding page.
 */
import { NextRequest } from 'next/server'
import {
  initRegistry as initPlumbing,
  getChatSessionInstance as getPlumbingSession,
  SESSION_ID as PLUMBING_ID,
} from '@agents/steadfastPlumbing'
import {
  initRegistry as initOnboarding,
  getChatSessionInstance as getOnboardingSession,
  SESSION_ID as ONBOARDING_ID,
} from '@agents/onboarding'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { message?: string; sessionId?: string }
  const { message, sessionId = PLUMBING_ID } = body

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let session
  if (sessionId === ONBOARDING_ID) {
    initOnboarding()
    session = getOnboardingSession(sessionId)
  } else {
    initPlumbing()
    session = getPlumbingSession(sessionId)
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
