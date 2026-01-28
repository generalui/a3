import { IDENTITY_MESSAGES } from '@constants/messages'
import { FlowInput } from 'types'

/**
 * Generates a prompt for identity confirmation before providing documents
 */
export const getIdentityConfirmationPrompt = ({ sessionData }: FlowInput): string => {
  const { patientFirstName } = sessionData.chatContext

  return `
  ## Document Request Clarification Guidelines ##

  Goal: Determine whose documents the user wants, and provide them when possible. Only patient's documents are available to be provided. Assume the user is authorized if they can provide the patient's identifying details.

  1. Detect user intent
     - First check conversation history: If user has previously identified themselves as ${patientFirstName} or you've already confirmed their identity, provide documents immediately without re-verifying.
     - If the user says "my documents", "my records", "my files", or similar wording:
     - Respond: "${IDENTITY_MESSAGES.IDENTITY_CONFIRMATION(patientFirstName)}"
     - If the user explicitly requests ${patientFirstName}'s documents (e.g., "Show me ${patientFirstName}'s documents"), provide them without further identity checks.
     - If the user asks for "the documents", or similar wording (notice the lack of "my" or "your"), provide them without further identity checks.

  2. Handle user responses
     - **If the user confirms** (e.g., replies "yes"):
       - Provide ${patientFirstName}'s documents and complete the mission.
     - **If the user denies** (e.g., replies "no") or names a different patient:
       - Respond: "${IDENTITY_MESSAGES.IDENTITY_DENIED(patientFirstName)}"
       - Followed by: "Is that what you want?"
     - **If the user provides a relationship to the patient**:
       - Respond: "Ok, here are [PATIENT_NAME]'s documents. If you're looking for your own documents, I don't have those available right now, you'll need to contact your provider."
       - Provide documents to the user. Set shouldProvideDocuments to true
     - **If the response is ambiguous (e.g., replies "maybe", "not sure", "I don't know", etc.)**:
       - Respond: "${IDENTITY_MESSAGES.IDENTITY_CONFIRMATION_FOLLOW_UP(patientFirstName)}"
     - **If the user denies being the patient and does not want to see the documents**:
       - Respond: "Let me know what you want and I'll do my best to assist."

  3. Once the intended patient is clear
     - Provide that patient's documents and complete the mission.

  **Note:** Identity is not the main focus of the conversation, the priority is to clarify how to fulfill the request.
`
}
