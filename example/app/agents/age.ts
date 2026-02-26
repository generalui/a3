import { z } from 'zod'
import { Agent, simpleAgentResponse } from '@genui-a3/core'
import { State } from './greeting'

/**
 * Sample age agent that gets the user's age.
 */
const agePayload = z.object({
  userAge: z.string().optional(),
})

export const ageAgent: Agent<State> = {
  id: 'age',
  description: 'Asks the user for their age',
  name: 'Age Agent',
  // eslint-disable-next-line @typescript-eslint/require-await
  promptGenerator: async () => `
    You are a friendly agent. Your goal is to learn the user's age.
    If you don't know their age yet, ask for it politely.
    Once you have their age, confirm it and set goalAchieved to true.
  `,
  outputSchema: agePayload,
  generateAgentResponse: simpleAgentResponse,
  nextAgentSelector: (state, agentGoalAchieved) => {
    if (agentGoalAchieved) {
      return 'age'
    }
    return 'age'
  },
}
