import { z } from 'zod'
import { Agent, ChatState, AgentId } from 'types'
import { promptGenerator } from './prompt'
import { generateAgentResponse } from './response'

export const prescriptionManagementPayload = z.object({
  // Placeholder for future state
})

export const responseFormat = z.object({
  conversationPayload: prescriptionManagementPayload,
  goalAchieved: z.boolean().optional(),
  chatbotMessage: z.string(),
})

export type PrescriptionManagementResponse = z.infer<typeof responseFormat>

export const prescriptionManagement: Agent = {
  id: AgentId.PRESCRIPTION_MANAGEMENT,
  name: 'Prescription Management',
  generateAgentResponse,
  promptGenerator,
  responseFormat,
  fitDataInGeneralFormat: (data: PrescriptionManagementResponse['conversationPayload'], generalData: ChatState) => {
    return { ...generalData, ...data }
  },
}
