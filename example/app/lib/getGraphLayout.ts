import dagre from '@dagrejs/dagre'
import { MarkerType, type Node, type Edge } from '@xyflow/react'
import type { AgentInfo } from './getAgentGraphData'

const NODE_WIDTH = 160
const NODE_HEIGHT = 44

/**
 * Compute a top-to-bottom dagre layout for the agent graph and return
 * React Flow–compatible nodes and edges.
 *
 * Self-loop edges are excluded from dagre (which expects a DAG) and added
 * separately with a custom `selfLoop` edge type.
 */
export function getGraphLayout(agents: AgentInfo[], activeAgentId: string | null): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 40 })

  for (const agent of agents) {
    g.setNode(agent.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const agent of agents) {
    for (const target of agent.transition.targets) {
      if (target !== agent.id) {
        g.setEdge(agent.id, target)
      }
    }
  }

  dagre.layout(g)

  const resolvedActiveId = activeAgentId ?? agents[0]?.id ?? null

  const nodes: Node[] = agents.map((agent) => {
    const { x, y } = g.node(agent.id) as unknown as { x: number; y: number }
    return {
      id: agent.id,
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      data: {
        label: agent.id,
        isActive: agent.id === resolvedActiveId,
        description: agent.description,
      },
      type: 'agent',
    }
  })

  const positionOf = new Map<string, { x: number; y: number }>()
  for (const agent of agents) {
    const { x, y } = g.node(agent.id) as unknown as { x: number; y: number }
    positionOf.set(agent.id, { x, y })
  }

  const edges: Edge[] = []
  for (const agent of agents) {
    const isDynamic = agent.transition.type === 'dynamic'
    const strokeColor = isDynamic ? '#94a3b8' : '#64748b'

    for (const target of agent.transition.targets) {
      const marker = {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
        width: 15,
        height: 15,
      }

      if (target === agent.id) {
        edges.push({
          id: `${agent.id}-${target}`,
          source: agent.id,
          target,
          type: 'selfLoop',
          data: { isDynamic },
          markerEnd: marker,
          sourceHandle: 'source-bottom',
          targetHandle: 'target-top',
        })
      } else {
        const sourceY = positionOf.get(agent.id)!.y
        const targetY = positionOf.get(target)!.y
        const isBackEdge = sourceY >= targetY

        edges.push({
          id: `${agent.id}-${target}`,
          source: agent.id,
          target,
          type: isDynamic ? 'dynamic' : 'deterministic',
          markerEnd: marker,
          sourceHandle: isBackEdge ? 'source-right' : 'source-bottom',
          targetHandle: isBackEdge ? 'target-right' : 'target-top',
        })
      }
    }
  }

  return { nodes, edges }
}
