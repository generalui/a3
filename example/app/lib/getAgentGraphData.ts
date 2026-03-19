import { agentRegistry } from '@agents/registry'

export type AgentInfo = {
  id: string
  description: string
  transition: { type: 'deterministic' | 'dynamic' | 'none'; targets: string[] }
}

/**
 * Returns registered agents with transition metadata for the AgentGraph visualization component.
 * Caller is responsible for ensuring agents are registered before calling this function.
 */
export function getAgentGraphData(): AgentInfo[] {
  const agents = agentRegistry.getAll()
  const allAgentIds = agents.map((a) => a.id)

  return agents.map((agent) => {
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
  })
}
