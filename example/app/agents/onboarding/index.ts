import { z } from 'zod'
import { Agent } from '@genui/a3'
import type { State } from '@agents/state'
import { prompt } from './prompt'

/**
 * Agent that knows everything there is to know about A3 framework, answers questions about it and guides users
 * through the process of using it.
 */
export const onboardingAgent: Agent<State> = {
  id: 'onboarding',
  description: 'Onboards users to the A3 framework.',
  prompt: (params) => prompt(params),
  outputSchema: z.object({}),
}
