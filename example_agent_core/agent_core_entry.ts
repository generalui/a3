import { BedrockAgentCoreApp } from 'bedrock-agentcore/runtime'
import { AgentRegistry, ChatSession, AgentCoreMemoryStore } from '@genui-a3/core'
import { greetingAgent, State } from './agents/greeting.js'

// Register the agent on module load
const registry = AgentRegistry.getInstance<State>()
registry.register(greetingAgent)

// Shared store instance (in production, use Redis/DynamoDB)
const store = new AgentCoreMemoryStore<State>({
  memoryId: 'example_a3_agent_core_mem-15dAHMA2D6',
  region: 'us-west-2',
})

const app = new BedrockAgentCoreApp({
  invocationHandler: {
    process: async (payload) => {
      const { prompt = 'hello' } = payload as {
        prompt?: string
      }

      const session = new ChatSession<State>({
        sessionId: 'demo-session-5',
        store,
        initialAgentId: 'greeting',
        initialState: { userName: undefined },
      })

      const result = await session.send(prompt)

      return result
    },
  },
})

app.run()
