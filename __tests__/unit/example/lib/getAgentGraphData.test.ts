import type { Agent } from 'types'

const mockGetAll = jest.fn<() => Agent[]>()
const mockGetTransitionTargetMap = jest.fn<() => Map<string, string[]>>()

jest.mock('@agents/registry', () => ({
  agentRegistry: {
    getAll: mockGetAll,
  },
}))

jest.mock('../../../../example/app/lib/parseTransitionTargets', () => ({
  getTransitionTargetMap: mockGetTransitionTargetMap,
}))

import { getAgentGraphData } from '../../../../example/app/lib/getAgentGraphData'

describe('getAgentGraphData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns dynamic transition with targets from array', () => {
    mockGetAll.mockReturnValue([
      { id: 'a', description: 'Agent A', transition: ['b'] },
      { id: 'b', description: 'Agent B' },
    ] as Agent[])
    mockGetTransitionTargetMap.mockReturnValue(new Map())

    const result = getAgentGraphData()

    expect(result[0].transition).toEqual({ type: 'dynamic', targets: ['b'] })
  })

  it('returns deterministic transition with targets from targetMap', () => {
    const fn = jest.fn()
    mockGetAll.mockReturnValue([
      { id: 'a', description: 'Agent A', transition: fn },
      { id: 'b', description: 'Agent B' },
    ] as Agent[])
    mockGetTransitionTargetMap.mockReturnValue(new Map([['a', ['b']]]))

    const result = getAgentGraphData()

    expect(result[0].transition).toEqual({ type: 'deterministic', targets: ['b'] })
  })

  it('falls back to all other agent IDs when targetMap has no entry', () => {
    const fn = jest.fn()
    mockGetAll.mockReturnValue([
      { id: 'a', description: 'Agent A', transition: fn },
      { id: 'b', description: 'Agent B' },
      { id: 'c', description: 'Agent C' },
    ] as Agent[])
    mockGetTransitionTargetMap.mockReturnValue(new Map())

    const result = getAgentGraphData()

    expect(result[0].transition).toEqual({ type: 'deterministic', targets: ['b', 'c'] })
  })

  it('returns none transition when no transition property', () => {
    mockGetAll.mockReturnValue([{ id: 'a', description: 'Agent A' }] as Agent[])
    mockGetTransitionTargetMap.mockReturnValue(new Map())

    const result = getAgentGraphData()

    expect(result[0].transition).toEqual({ type: 'none', targets: [] })
  })

  it('returns correct id and description for each agent', () => {
    mockGetAll.mockReturnValue([
      { id: 'greeting', description: 'Greets users' },
      { id: 'farewell', description: 'Says goodbye' },
    ] as Agent[])
    mockGetTransitionTargetMap.mockReturnValue(new Map())

    const result = getAgentGraphData()

    expect(result).toEqual([
      { id: 'greeting', description: 'Greets users', transition: { type: 'none', targets: [] } },
      { id: 'farewell', description: 'Says goodbye', transition: { type: 'none', targets: [] } },
    ])
  })
})
