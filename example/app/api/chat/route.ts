/**
 * Synchronous (blocking / unary) chat endpoint.
 * Used by the Hello World example.
 */
import { NextRequest, NextResponse } from 'next/server'
import { initRegistry, getChatSessionInstance, SESSION_ID as HELLO_WORLD_ID } from '@agents/helloWorld'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { message?: string; sessionId?: string }
    const { message, sessionId = HELLO_WORLD_ID } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    initRegistry()

    const session = getChatSessionInstance(sessionId)
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
