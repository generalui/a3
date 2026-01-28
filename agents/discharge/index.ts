import { z } from 'zod'
import { Agent, ChatState, AgentId } from 'types'
import { promptGenerator } from './prompt'
import { generateAgentResponse } from './response'
import { excludeAuthMessages } from '@utils/filterHistory'

export const dischargePayload = z.object({
  shouldProvideDocuments: z
    .boolean()
    .describe(
      'Whether to provide documents immediately after user asks for them the first time. This is used to allow the agent to interact with the user before providing documents.',
    ),
})

export const responseFormat = z.object({
  conversationPayload: dischargePayload,
  goalAchieved: z.boolean().optional(),
  chatbotMessage: z.string(),
})

export type DischargeResponse = z.infer<typeof responseFormat>

export const discharge: Agent = {
  id: AgentId.DISCHARGE,
  name: 'Discharge Documentation',
  generateAgentResponse,
  promptGenerator,
  responseFormat,
  fitDataInGeneralFormat: (data: DischargeResponse['conversationPayload'], generalData: ChatState) => {
    return { ...generalData, ...data }
  },
  filterHistoryStrategy: excludeAuthMessages,
}
