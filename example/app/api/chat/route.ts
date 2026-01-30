import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  AgentRegistry,
  Agent,
  manageFlow,
  simpleAgentResponse,
  MessageSender,
  BaseState,
  SessionData,
} from '@genui-a3/core'

/**
 * Consumer defines their GLOBAL state extending BaseState.
 * This state is shared across ALL agents in the session.
 */
interface State extends BaseState {
  userName?: string
}

/**
 * Sample greeting agent that demonstrates the AgentRegistry pattern.
 */
const greetingPayload = z.object({
  userName: z.string().optional(),
})

const greetingAgent: Agent<State> = {
  id: 'greeting',
  description: 'Greets the user and collects their name',
  name: 'Greeting Agent',
  // eslint-disable-next-line @typescript-eslint/require-await
  promptGenerator: async () => `
    You are a friendly greeting agent. Your goal is to greet the user and learn their name.
    If you don't know their name yet, ask for it politely.
    Once you have their name, greet them by name and set goalAchieved to true.
  `,
  outputSchema: greetingPayload,
  generateAgentResponse: simpleAgentResponse,
  nextAgentSelector: (state, agentGoalAchieved) => {
    if (agentGoalAchieved) {
      return 'end'
    }
    return 'greeting'
  },
  fitDataInGeneralFormat: (data: z.infer<typeof greetingPayload>, state) => ({
    ...state,
    ...data,
  }),
}

// Register the agent on module load
const registry = AgentRegistry.getInstance<State>()
registry.register(greetingAgent)

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { message?: string; sessionId?: string }
    const { message, sessionId = 'demo-session' } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Build session data with typed State
    const sessionData: SessionData<State> = {
      sessionId,
      messages: [{ text: message, metadata: { source: MessageSender.USER } }],
      activeAgentId: 'greeting',
      state: { userName: undefined },
      chatContext: {},
    }

    // Run the agent flow
    const result = await manageFlow({
      agent: greetingAgent,
      sessionData,
    })

    return NextResponse.json({
      response: result.responseMessage,
      activeAgentId: result.activeAgentId,
      nextAgentId: result.nextAgentId,
      state: result.newState, // result.newState is typed as State
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
