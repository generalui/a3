import { agentRegistry } from '@agents/registry'
import { getTransitionTargetMap } from './parseTransitionTargets'

export type AgentInfo = {
  id: string
  description: string
  transition: { type: 'deterministic' | 'dynamic' | 'none'; targets: string[] }
}

/**
 * Returns registered agents with transition metadata for the AgentGraph visualization component.
 * Caller is responsible for ensuring agents are registered before calling this function.
 *
 * For deterministic transitions (functions), uses AST parsing to discover the actual
 * target agent IDs from the source code rather than listing all other agents.
 */
export function getAgentGraphData(): AgentInfo[] {
  const agents = agentRegistry.getAll()
  const allAgentIds = agents.map((a) => a.id)
  const targetMap = getTransitionTargetMap()

  return agents.map((agent) => {
    let type: 'deterministic' | 'dynamic' | 'none'
    let targets: string[]

    if (Array.isArray(agent.transition)) {
      type = 'dynamic'
      targets = agent.transition
    } else if (typeof agent.transition === 'function') {
      type = 'deterministic'
      targets = targetMap.get(agent.id) ?? allAgentIds.filter((id) => id !== agent.id)
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
