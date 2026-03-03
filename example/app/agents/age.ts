import { z } from 'zod'
import { Agent } from '@genui-a3/core'
import { State } from './greeting'

/**
 * Sample age agent that gets the user's age.
 */
const agePayload = z.object({
  userAge: z.string().optional(),
})

export const ageAgent: Agent<State> = {
  id: 'age',
  prompt: `
    You are a friendly agent. Your goal is to learn the user's age.
    If you don't know their age yet, ask for it politely.
    Once you have their age, confirm it and set goalAchieved to true.
  `,
  outputSchema: agePayload,
  nextAgentSelector: (state, agentGoalAchieved) => {
    if (agentGoalAchieved) {
      return 'age'
    }
    return 'age'
  },
}
