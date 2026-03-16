import { Agent, AgentId, BaseState, BaseChatContext } from 'types'
import { AgentRegistry } from '@core/AgentRegistry'

/**
 * Generates a formatted string listing agents from the registry for the provided agent IDs.
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
 * // - 'consent': Collects the user's consent to be assisted by the agent
 * // - 'basicPatientInfo': Collects basic patient information (e.g., user name, user DOB, reason for visit)
 * ```
 */
export function generateAgentPool(agentIds: AgentId[]): string {
  if (agentIds.length === 0) {
    return ''
  }

  return agentIds.map((id) => generateAgentPoolItem(id)).join('\n')
}

/**
 * Generates a formatted string for a single agent item
 *
 * @param agentId - The ID of the agent to format
 * @returns A formatted string for the agent
 * @throws Error if the agent ID is invalid or has no description
 */
export function generateAgentPoolItem(agentId: AgentId): string {
  const agent = AgentRegistry.getInstance().get(agentId)
  if (!agent?.description) {
    throw new Error(`Invalid agent ID: ${agentId}. No description found.`)
  }

  return `- '${agentId}': ${agent.description}`
}

/**
 * Gets the agent IDs that should be included in the agent pool for a given agent.
 * Returns the current agent's ID plus any agents it can transition to (when transition is an array).
 * When transition is a function (deterministic routing), only the current agent's ID is returned.
 *
 * @param agent - The agent to get the pool IDs for
 * @returns An array of AgentId values
 */
export function getAgentPoolIds<TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>(
  agent: Agent<TState, TContext>,
): AgentId[] {
  const transitionTargets = Array.isArray(agent.transition) ? agent.transition : []
  return [agent.id, ...transitionTargets]
}
