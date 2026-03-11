/**
 * Synchronous (blocking / unary) chat endpoint.
 * This is the non-streaming version of the /api/stream endpoint.
 * It waits for the full agent response before returning a complete JSON payload.
 */
import { NextRequest, NextResponse } from 'next/server'
import { AgentRegistry, ChatSession, MemorySessionStore } from '@genui-a3/core'
import { createBedrockProvider } from '@genui-a3/providers/bedrock'
import { greetingAgent, State } from '../../agents/greeting'
import { ageAgent } from '../../agents/age'

// Register the agent on module load
const registry = AgentRegistry.getInstance<State>()
if (!registry.has('greeting')) {
  registry.register(greetingAgent)
}
if (!registry.has('age')) {
  registry.register(ageAgent)
}

// Shared store instance (in production, use Redis/DynamoDB)
const store = new MemorySessionStore<State>()

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'us.anthropic.claude-haiku-4-5-20251001-v1:0'],
})

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { message?: string; sessionId?: string }
    const { message, sessionId = 'demo-session' } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Create session and send message
    const session = new ChatSession<State>({
      sessionId,
      store,
      initialAgentId: 'greeting',
      initialState: { userName: undefined },
      provider,
    })

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

// GET endpoint to list available agents
export function GET() {
  const agents = AgentRegistry.getInstance().getAll()
  return NextResponse.json({
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
    })),
  })
}
