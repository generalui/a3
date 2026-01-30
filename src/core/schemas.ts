import { z } from 'zod'
import { AgentId } from 'types'

const baseResponseSchema = z.object({
  chatbotMessage: z.string().describe('Your response to the user'),
  goalAchieved: z.boolean().describe('True if the agent has achieved its goal'),
  redirectToAgent: z.string().nullable(),
  conversationPayload: z.any(),
})

export type BaseResponse = z.infer<typeof baseResponseSchema>

/**
 * Creates a full output schema by merging base fields with the agent's outputSchema.
 * If transitionsTo is provided, redirectToAgent is constrained to those values.
 */
export function createFullOutputSchema<T extends z.ZodObject<{ [key: string]: z.ZodTypeAny }>>(
  outputSchema: T,
  transitionsTo?: AgentId[],
) {
  // Create redirectToAgent field - either enum (if transitionsTo provided) or string
  const redirectToAgentField =
    transitionsTo && transitionsTo.length > 0
      ? z
          .enum(transitionsTo as [string])
          .nullable()
          .describe(`Next agent to hand off to (${transitionsTo.join(', ')}), or null`)
      : z.string().nullable().describe('Next agent to hand off to, or null')

  return baseResponseSchema.extend({
    redirectToAgent: redirectToAgentField,
    conversationPayload: outputSchema,
  })
}
