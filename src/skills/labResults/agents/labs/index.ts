import { z } from 'zod'
import { Agent, ChatState, AgentId } from 'types'
import { excludeAuthMessages } from '@utils/filterHistory'
import { promptGenerator } from './prompt'
import { generateAgentResponse } from './response'

export const labsPayload = z.object({
  shouldProvideDocuments: z
    .boolean()
    .describe(
      'Whether to provide documents immediately after user asks for them the first time. This is used to allow the agent to interact with the user before providing documents.',
    ),
})

export const responseFormat = z.object({
  conversationPayload: labsPayload,
  goalAchieved: z.boolean().optional(),
  chatbotMessage: z.string(),
})

export type LabsResponse = z.infer<typeof responseFormat>

export const labs: Agent = {
  id: AgentId.LAB_RESULTS,
  name: 'Lab Results',
  generateAgentResponse,
  promptGenerator,
  responseFormat,
  fitDataInGeneralFormat: (data: LabsResponse['conversationPayload'], generalData: ChatState) => {
    return { ...generalData, ...data }
  },
  filterHistoryStrategy: excludeAuthMessages,
}
