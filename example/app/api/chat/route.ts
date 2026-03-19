/**
 * Synchronous (blocking / unary) chat endpoint.
 * This is the non-streaming version of the /api/stream endpoint.
 * It waits for the full agent response before returning a complete JSON payload.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getChatSessionInstance } from '@agents'
import { initRegistry } from '@agents/registry'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { message?: string; sessionId?: string }
    const { message, sessionId = 'demo-session' } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    initRegistry()

    const session = getChatSessionInstance({ sessionId })
    const result = await session.send({ message })

    return NextResponse.json({
      response: result.responseMessage,
      activeAgentId: result.activeAgentId,
      nextAgentId: result.nextAgentId,
      state: result.state,
      goalAchieved: result.goalAchieved,
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}
