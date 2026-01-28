import { z } from 'zod'
import { Agent, ChatState, AgentId, Conversation } from 'types'
import { promptGenerator } from './prompt'
import { generateAgentResponse } from './response'

export const authPayload = z.object({
  authenticationPassed: z.boolean().nullable(),
  LastNameToValidate: z
    .string()
    .nullable()
    .describe(
      "The user's input for last name validation. ONLY populate when user is explicitly attempting to authenticate. Leave null for general questions or conversations.",
    ),
  DobToValidate: z
    .string()
    .nullable()
    .describe(
      "The user's input for date of birth validation. ONLY populate when user is explicitly attempting to authenticate. Leave null for general questions or conversations.",
    ),
})

export const responseFormat = z.object({
  conversationPayload: authPayload,
  goalAchieved: z.boolean().optional(),
  chatbotMessage: z.string(),
})

export type AuthResponse = z.infer<typeof responseFormat>

export const auth: Agent = {
  id: AgentId.AUTH,
  name: 'Authentication',
  generateAgentResponse,
  promptGenerator,
  responseFormat,
  fitDataInGeneralFormat: (data: AuthResponse['conversationPayload'], chatState: ChatState) => {
    return { ...chatState, ...data }
  },
  nextAgentSelector: (chatState: ChatState, agentGoalAchieved: boolean) => {
    // If still trying to authenticate
    if (!agentGoalAchieved) {
      return AgentId.AUTH
    }

    // Return to requesting agent if authentication passed
    const result = chatState.requestingAgent || AgentId.WRAP_UP
    return result
  },
  filterHistoryStrategy: (messages: Conversation) => {
    return messages.slice(-2) // Only keep the last two messages
  },
}
