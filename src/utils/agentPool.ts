import { z } from 'zod'
import { Agent, AgentId, AGENT_DESCRIPTIONS } from 'types'
import { log } from '@utils/logger'

/**
 * Generates a formatted string listing the agents based on the provided agent IDs.
 * The format matches the one used in basePrompt.ts:
 * - 'agentId': Description of the agent
 *
 * @param agentIds - Array of AgentId values representing the agents to include
 * @returns A formatted string listing the agents and their descriptions
 *
 * @example
 * ```typescript
 * // Create a formatted string with consent and basic patient info agents
 * const agentsList = generateAgentPool([AgentId.CONSENT, AgentId.BASIC_PATIENT_INFO]);
 * // Result will be:
 * // - 'consent': Collects the user's consent to be assisted by the CareAgent agent
 * // - 'basicPatientInfo': Collects basic patient information (e.g., user name, user DOB, reason for visit)
 * ```
 */
export function generateAgentPool(agents: Agent[], agentIds: AgentId[]): string {
  // Filter the agents array to include only those with IDs in the agentIds array
  const filteredAgents = agents.filter((agent) => agentIds.includes(agent.id))

  if (filteredAgents.length === 0) {
    return ''
  }

  // Format each agent as a line in the output string
  return filteredAgents.map((agent) => generateAgentPoolItem(agent.id)).join('\n')
}

/**
 * Generates a formatted string for a single agent item
 *
 * @param agentId - The ID of the agent to format
 * @returns A formatted string for the agent
 * @throws Error if the agent ID is invalid or has no description
 */
export function generateAgentPoolItem(agentId: AgentId): string {
  if (!AGENT_DESCRIPTIONS[agentId]) {
    throw new Error(`Invalid agent ID: ${agentId}. No description found.`)
  }

  return `- '${agentId}': ${AGENT_DESCRIPTIONS[agentId]}`
}

/**
 * Gets the array of agent IDs to include in the specialist agent pool for a given agent.
 * This includes the agent's own ID and any agent IDs that it can redirect to.
 *
 * @param agent - The agent to get the pool IDs for
 * @returns An array of AgentId values
 */
export function getAgentPoolIds(agent: Agent): AgentId[] {
  // Start with the current agent's ID
  const agentIds = [agent.id]

  // If response format is a function, return without further processing
  if (typeof agent.responseFormat === 'function') {
    return agentIds
  }

  // If agent's response format has a redirectToAgent schema, include those agents in the pool
  try {
    // Access the redirectToAgent schema and cast it to the appropriate Zod type
    const redirectSchema = agent.responseFormat.shape.redirectToAgent as z.ZodType<AgentId | null>

    if (typeof redirectSchema === 'undefined') {
      return agentIds
    }

    // Get the values from the schema based on whether it's nullable or not
    let enumValues: readonly (string | null)[] = []

    // The schema might be a ZodNullable containing a ZodEnum, or directly a ZodEnum
    // Note: We use 'any' here because Zod v4 changed the type constraint for ZodEnum
    // from tuple-based to record-based, causing type mismatch errors with strict casting
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
    if ('innerType' in redirectSchema._def) {
      // It's a nullable enum
      const innerSchema = redirectSchema._def.innerType as any
      if (innerSchema?._def?.values) {
        const values = innerSchema._def.values
        enumValues = Array.isArray(values) ? values : Object.values(values)
      }
    } else {
      // It's a direct enum
      const directEnum = redirectSchema as any
      if (directEnum?._def?.values) {
        const values = directEnum._def.values
        enumValues = Array.isArray(values) ? values : Object.values(values)
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

    // Add non-null values to our agent pool
    const allowedRedirects = enumValues
      .filter((value): value is string => value !== null)
      .map((value) => value as unknown as AgentId)

    // Add these to our agent pool
    agentIds.push(...allowedRedirects)
  } catch {
    // If we can't parse the schema, just use the current agent ID
    log.info('Could not parse redirectToAgent schema, defaulting to current agent ID')
  }

  return agentIds
}
