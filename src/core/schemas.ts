import { z } from 'zod'
import { ChatState } from 'types'

// Base schema that all agents will extend
export const baseResponseSchema = z.object({
  goalAchieved: z.boolean(),
  chatbotMessage: z.string(),
  redirectToAgent: z.string().nullable(),
  conversationPayload: z.any(),
})

export type BaseResponse = z.infer<typeof baseResponseSchema>

export const initialGeneralData: ChatState = {
  // General
  goalAchieved: false,
  appointmentAction: null,
  requestingAgent: null,
  // Auth
  authenticationPassed: false,
  authAttemptCount: 0,
  nonAuthAttemptCount: 0,
  LastNameToValidate: '',
  DobToValidate: '',
  isLockedOut: false,
  // Discharge
  documentsSent: false,
  // Labs
  labResultsConsent: null,
}
