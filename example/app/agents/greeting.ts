import { z } from 'zod'
import { Agent, simpleAgentResponse, BaseState } from '@genui-a3/core'

/**
 * Consumer defines their GLOBAL state extending BaseState.
 * This state is shared across ALL agents in the session.
 */
export interface State extends BaseState {
  userName?: string
  userAge?: string
}

/**
 * Sample greeting agent that demonstrates the AgentRegistry pattern.
 */
const greetingPayload = z.object({
  userName: z.string().optional(),
})

export const greetingAgent: Agent<State> = {
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
      return 'age'
    }
    return 'greeting'
  },
  fitDataInGeneralFormat: (data: z.infer<typeof greetingPayload>, state) => ({
    ...state,
    ...data,
  }),
}
