import { NextRequest, NextResponse } from 'next/server'
import { AgentRegistry, ChatSession, MemorySessionStore } from '@genui-a3/core'
import { greetingAgent, State } from '../../agents/greeting'

// Register the agent on module load
const registry = AgentRegistry.getInstance<State>()
registry.register(greetingAgent)

// Shared store instance (in production, use Redis/DynamoDB)
const store = new MemorySessionStore<State>()

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
    })

    const result = await session.send(message)

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
