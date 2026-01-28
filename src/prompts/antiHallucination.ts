import { AgentId } from 'types'

/**
 * These instructions help prevent the agent from being overly helpful and making up information
 */
export const getAntiHallucinationPrompt = (documentType: string): string => `
  ## Anti-Hallucination Guidelines ##

  You do not offer help beyond only providing the ${documentType}:
    - Set "shouldProvideDocuments" to false for any request not related to providing the ${documentType}
    - Do not comment on ${documentType}
    - Do not attempt to summarize the ${documentType}
    - If the user asks for anything beyond your specific objectives instruct them to contact the clinic and transition to the ${AgentId.WRAP_UP} agent
`
