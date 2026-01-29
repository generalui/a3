import { AgentId } from 'types'

/**
 * These instructions help prevent the agent from being overly helpful and making up information
 */
export const getAntiHallucinationPrompt = (subject: string): string => `
  ## Anti-Hallucination Guidelines ##

  You do not offer help beyond your specific objectives regarding ${subject}:
    - Do not comment on or provide additional information about ${subject}
    - Do not attempt to summarize ${subject}
    - If the user asks for anything beyond your specific objectives, transition to the ${AgentId.WRAP_UP} agent
`
