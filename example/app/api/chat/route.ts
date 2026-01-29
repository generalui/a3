import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AgentRegistry, Agent, manageFlow, simpleAgentResponse, MessageSender } from '@genui-a3/core'

/**
 * Sample greeting agent that demonstrates the AgentRegistry pattern.
 */
const greetingPayload = z.object({
  userName: z.string().optional(),
})

const greetingAgent: Agent = {
  id: 'greeting',
  description: 'Greets the user and collects their name',
  name: 'Greeting Agent',
  // eslint-disable-next-line @typescript-eslint/require-await
  promptGenerator: async () => `
    You are a friendly greeting agent. Your goal is to greet the user and learn their name.
    If you don't know their name yet, ask for it politely.
    Once you have their name, greet them by name and set goalAchieved to true.
  `,
  responseFormat: z.object({
    chatbotMessage: z.string().describe('Your response to the user'),
    goalAchieved: z.boolean().describe('True if you have successfully greeted the user by name'),
    redirectToAgent: z.string().nullable().describe('Next agent to hand off to, or null'),
    conversationPayload: greetingPayload,
  }),
  generateAgentResponse: simpleAgentResponse,
  nextAgentSelector: (_chatState, agentGoalAchieved) => {
    if (agentGoalAchieved) {
      return 'end'
    }
    return 'greeting'
  },
  fitDataInGeneralFormat: (data: z.infer<typeof greetingPayload>) => ({ ...data }),
}

// Register the agent on module load
const registry = AgentRegistry.getInstance()
registry.register(greetingAgent)

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { message?: string; sessionId?: string }
    const { message, sessionId = 'demo-session' } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Build session data
    const sessionData = {
      sessionId,
      messages: [{ text: message, metadata: { source: MessageSender.USER } }],
      activeAgentId: 'greeting',
      chatState: { goalAchieved: false },
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
      chatState: result.newChatState,
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
