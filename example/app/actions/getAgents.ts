'use server'

import { agentRegistry, initRegistry } from '@agents/registry'

/**
 * Server action that returns registered agents with transition metadata
 * for the AgentGraph visualization component.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function getAgents() {
  initRegistry()
  const agents = agentRegistry.getAll()
  const allAgentIds = agents.map((a) => a.id)

  return {
    agents: agents.map((agent) => {
      let type: 'deterministic' | 'dynamic' | 'none'
      let targets: string[]

      if (Array.isArray(agent.transition)) {
        type = 'dynamic'
        targets = agent.transition
      } else if (typeof agent.transition === 'function') {
        type = 'deterministic'
        targets = allAgentIds.filter((id) => id !== agent.id)
      } else {
        type = 'none'
        targets = []
      }

      return {
        id: agent.id,
        description: agent.description,
        transition: { type, targets },
      }
    }),
  }
}
