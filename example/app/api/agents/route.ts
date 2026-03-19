import { NextResponse } from 'next/server'
import { agentRegistry } from '@lib/agentSetup'

/**
 * GET /api/agents — returns registered agents with transition metadata
 * for the AgentGraph visualization component.
 */
export function GET() {
  const agents = agentRegistry.getAll()
  const allAgentIds = agents.map((a) => a.id)

  return NextResponse.json({
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
  })
}
