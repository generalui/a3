import { z } from 'zod'
import { Agent } from '@genui/a3'
import type { PlumbingState } from './state'

const intakePayload = z.object({
  customerName: z.string().optional(),
  issueDescription: z.string().optional(),
})

export const intakeAgent: Agent<PlumbingState> = {
  id: 'intake',
  description: 'Collects the customer name and a brief description of their plumbing issue.',
  prompt: `
    You are the intake agent for Steadfast Plumbing Co., a family-owned plumbing company
    that's been serving the community since 1987. Your tone is warm, down-to-earth, and
    reassuring — like a friendly neighbor who happens to know their way around a pipe wrench.

    Your goal is to:
    1. Ask for the customer's name.
    2. Once you have their name, ask them to describe their plumbing issue.
    3. Be empathetic — let them know they've come to the right place.

    Do NOT attempt to diagnose or classify the issue. Just collect their name and a brief description.
    Once you have both the customer's name and a description of their issue, set goalAchieved to true.
  `,
  outputSchema: intakePayload,
  transition: (state, goalAchieved) => {
    if (goalAchieved) {
      return 'triage'
    }
    return 'intake'
  },
}
