const mockRestart = jest.fn<() => Promise<Record<string, unknown>>>()
const mockGetChatSessionInstance = jest.fn().mockReturnValue({ restart: mockRestart })
const mockInitRegistry = jest.fn()

jest.mock('@agents', () => ({
  getChatSessionInstance: mockGetChatSessionInstance,
}))

jest.mock('@agents/registry', () => ({
  initRegistry: mockInitRegistry,
}))

import { restartSession } from '../../../../../example/app/lib/actions/restartSession'

describe('restartSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls initRegistry then session.restart and returns result', async () => {
    const expected = { messages: [], activeAgentId: null, state: {} }
    mockRestart.mockResolvedValue(expected)

    const result: unknown = await restartSession('session-123')

    expect(mockInitRegistry).toHaveBeenCalled()
    expect(mockGetChatSessionInstance).toHaveBeenCalledWith({ sessionId: 'session-123' })
    expect(result).toEqual(expected)
  })

  it('calls initRegistry before getChatSessionInstance', async () => {
    mockRestart.mockResolvedValue({})
    const callOrder: string[] = []
    mockInitRegistry.mockImplementation(() => callOrder.push('initRegistry'))
    mockGetChatSessionInstance.mockImplementation(() => {
      callOrder.push('getChatSessionInstance')
      return { restart: mockRestart }
    })

    await restartSession('s1')

    expect(callOrder).toEqual(['initRegistry', 'getChatSessionInstance'])
  })
})
