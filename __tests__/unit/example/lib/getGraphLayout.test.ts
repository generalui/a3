const mockSetNode = jest.fn()
const mockSetEdge = jest.fn()
const mockSetGraph = jest.fn()
const mockSetDefaultEdgeLabel = jest.fn()
const mockNodePositions: Record<string, { x: number; y: number }> = {}
const mockNode = jest.fn((id: string) => mockNodePositions[id])

jest.mock('@dagrejs/dagre', () => ({
  __esModule: true,
  default: {
    graphlib: {
      Graph: jest.fn().mockImplementation(() => ({
        setDefaultEdgeLabel: mockSetDefaultEdgeLabel,
        setGraph: mockSetGraph,
        setNode: mockSetNode,
        setEdge: mockSetEdge,
        node: mockNode,
      })),
    },
    layout: jest.fn(),
  },
}))

jest.mock('@xyflow/react', () => ({
  MarkerType: { ArrowClosed: 'arrowclosed' },
}))

import { getGraphLayout } from '../../../../example/app/lib/getGraphLayout'
import type { AgentInfo } from '../../../../example/app/lib/getAgentGraphData'

describe('getGraphLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const key of Object.keys(mockNodePositions)) {
      delete mockNodePositions[key]
    }
  })

  function setPositions(positions: Record<string, { x: number; y: number }>) {
    Object.assign(mockNodePositions, positions)
  }

  it('generates correct number of nodes and edges', () => {
    setPositions({ a: { x: 80, y: 22 }, b: { x: 80, y: 122 } })
    const agents: AgentInfo[] = [
      { id: 'a', description: 'A', transition: { type: 'deterministic', targets: ['b'] } },
      { id: 'b', description: 'B', transition: { type: 'none', targets: [] } },
    ]

    const { nodes, edges } = getGraphLayout(agents, 'a')

    expect(nodes).toHaveLength(2)
    expect(edges).toHaveLength(1)
  })

  it('marks active agent node with isActive true', () => {
    setPositions({ a: { x: 80, y: 22 }, b: { x: 80, y: 122 } })
    const agents: AgentInfo[] = [
      { id: 'a', description: 'A', transition: { type: 'none', targets: [] } },
      { id: 'b', description: 'B', transition: { type: 'none', targets: [] } },
    ]

    const { nodes } = getGraphLayout(agents, 'b')

    expect(nodes.find((n) => n.id === 'b')!.data.isActive).toBe(true)
    expect(nodes.find((n) => n.id === 'a')!.data.isActive).toBe(false)
  })

  it('defaults to first agent as active when activeAgentId is null', () => {
    setPositions({ a: { x: 80, y: 22 }, b: { x: 80, y: 122 } })
    const agents: AgentInfo[] = [
      { id: 'a', description: 'A', transition: { type: 'none', targets: [] } },
      { id: 'b', description: 'B', transition: { type: 'none', targets: [] } },
    ]

    const { nodes } = getGraphLayout(agents, null)

    expect(nodes.find((n) => n.id === 'a')!.data.isActive).toBe(true)
  })

  it('creates selfLoop edge type for self-referencing transitions', () => {
    setPositions({ a: { x: 80, y: 22 } })
    const agents: AgentInfo[] = [
      { id: 'a', description: 'A', transition: { type: 'deterministic', targets: ['a'] } },
    ]

    const { edges } = getGraphLayout(agents, 'a')

    expect(edges).toHaveLength(1)
    expect(edges[0].type).toBe('selfLoop')
    expect(edges[0].source).toBe('a')
    expect(edges[0].target).toBe('a')
  })

  it('uses bottom/top handles for forward edges', () => {
    setPositions({ a: { x: 80, y: 22 }, b: { x: 80, y: 122 } })
    const agents: AgentInfo[] = [
      { id: 'a', description: 'A', transition: { type: 'deterministic', targets: ['b'] } },
      { id: 'b', description: 'B', transition: { type: 'none', targets: [] } },
    ]

    const { edges } = getGraphLayout(agents, 'a')

    expect(edges[0].sourceHandle).toBe('source-bottom')
    expect(edges[0].targetHandle).toBe('target-top')
  })

  it('uses right/right handles for back edges (target above source)', () => {
    setPositions({ a: { x: 80, y: 22 }, b: { x: 80, y: 122 } })
    const agents: AgentInfo[] = [
      { id: 'a', description: 'A', transition: { type: 'none', targets: [] } },
      { id: 'b', description: 'B', transition: { type: 'deterministic', targets: ['a'] } },
    ]

    const { edges } = getGraphLayout(agents, 'a')

    expect(edges[0].sourceHandle).toBe('source-right')
    expect(edges[0].targetHandle).toBe('target-right')
  })

  it('assigns different edge types for dynamic vs deterministic transitions', () => {
    setPositions({ a: { x: 80, y: 22 }, b: { x: 80, y: 122 }, c: { x: 200, y: 122 } })
    const agents: AgentInfo[] = [
      { id: 'a', description: 'A', transition: { type: 'dynamic', targets: ['b'] } },
      { id: 'b', description: 'B', transition: { type: 'deterministic', targets: ['c'] } },
      { id: 'c', description: 'C', transition: { type: 'none', targets: [] } },
    ]

    const { edges } = getGraphLayout(agents, 'a')

    const abEdge = edges.find((e) => e.source === 'a' && e.target === 'b')!
    const bcEdge = edges.find((e) => e.source === 'b' && e.target === 'c')!

    expect(abEdge.type).toBe('dynamic')
    expect(bcEdge.type).toBe('deterministic')
  })

  it('sets node positions offset by half width/height', () => {
    setPositions({ a: { x: 100, y: 50 } })
    const agents: AgentInfo[] = [
      { id: 'a', description: 'A', transition: { type: 'none', targets: [] } },
    ]

    const { nodes } = getGraphLayout(agents, 'a')

    // NODE_WIDTH = 160, NODE_HEIGHT = 44
    expect(nodes[0].position).toEqual({ x: 100 - 80, y: 50 - 22 })
  })
})
