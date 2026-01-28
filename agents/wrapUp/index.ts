import { z } from 'zod'
import { simpleAgentResponse } from '@core/agent'
import { Agent, ChatState, AgentId } from 'types'
import { SessionData } from 'types/session'
import { getMainAgentForSkill } from '@utils/agentPool'
import { promptGenerator } from './prompt'

export const wrapUpPayload = z.object({})

/**
 * Creates a dynamic response format for the wrapUp agent based on the token type
 * This ensures only the appropriate agent for the current skill is available for redirection
 */
export const createWrapUpResponseFormat = (sessionData: SessionData) => {
  const tokenType = sessionData.tokenType
  const allowedAgentId = getMainAgentForSkill(tokenType)

  return z.object({
    conversationPayload: wrapUpPayload,
    goalAchieved: z.boolean(),
    chatbotMessage: z.string(),
    redirectToAgent: z.enum([allowedAgentId]).nullable(),
  })
}

export type WrapUpResponse = z.infer<ReturnType<typeof createWrapUpResponseFormat>>

export const wrapUp: Agent = {
  id: AgentId.WRAP_UP,
  name: 'Wrap Up',
  generateAgentResponse: simpleAgentResponse,
  promptGenerator,
  responseFormat: createWrapUpResponseFormat,
  fitDataInGeneralFormat: (data: WrapUpResponse['conversationPayload'], generalData: ChatState) => {
    return { ...generalData, ...data }
  },
  nextAgentSelector: (_generalData: ChatState, _agentGoalAchieved: boolean) => {
    return AgentId.WRAP_UP
  },
}
