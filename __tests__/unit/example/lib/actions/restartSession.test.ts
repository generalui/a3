const mockHelloWorldRestart = jest.fn<Promise<Record<string, unknown>>, []>()
const mockPlumbingRestart = jest.fn<Promise<Record<string, unknown>>, []>()
const mockOnboardingRestart = jest.fn<Promise<Record<string, unknown>>, []>()
const mockInitHelloWorld = jest.fn()
const mockInitPlumbing = jest.fn()
const mockInitOnboarding = jest.fn()
const mockGetHelloWorldSession = jest.fn().mockReturnValue({ restart: mockHelloWorldRestart })
const mockGetPlumbingSession = jest.fn().mockReturnValue({ restart: mockPlumbingRestart })
const mockGetOnboardingSession = jest.fn().mockReturnValue({ restart: mockOnboardingRestart })

jest.mock('@agents/helloWorld', () => ({
  initRegistry: mockInitHelloWorld,
  getChatSessionInstance: mockGetHelloWorldSession,
  SESSION_ID: 'hello-world',
}))

jest.mock('@agents/steadfastPlumbing', () => ({
  initRegistry: mockInitPlumbing,
  getChatSessionInstance: mockGetPlumbingSession,
  SESSION_ID: 'steadfast-plumbing',
}))

jest.mock('@agents/onboarding', () => ({
  initRegistry: mockInitOnboarding,
  getChatSessionInstance: mockGetOnboardingSession,
  SESSION_ID: 'onboarding',
}))

import { restartSession } from '../../../../../example/app/lib/actions/restartSession'

describe('restartSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['hello-world', () => mockHelloWorldRestart, () => mockInitHelloWorld, () => mockGetHelloWorldSession],
    ['onboarding', () => mockOnboardingRestart, () => mockInitOnboarding, () => mockGetOnboardingSession],
    ['steadfast-plumbing', () => mockPlumbingRestart, () => mockInitPlumbing, () => mockGetPlumbingSession],
    ['unknown-session', () => mockPlumbingRestart, () => mockInitPlumbing, () => mockGetPlumbingSession],
  ])('calls initRegistry and restart for sessionId "%s"', async (sessionId, getRestart, getInit, getSession) => {
    const expected = { messages: [], activeAgentId: null, state: {} }
    getRestart().mockResolvedValue(expected)

    const result: unknown = await restartSession(sessionId)

    expect(getInit()).toHaveBeenCalled()
    expect(getSession()).toHaveBeenCalledWith(sessionId)
    expect(result).toEqual(expected)
  })

  it('calls initRegistry before getChatSessionInstance', async () => {
    mockHelloWorldRestart.mockResolvedValue({})
    const callOrder: string[] = []
    mockInitHelloWorld.mockImplementation(() => callOrder.push('initRegistry'))
    mockGetHelloWorldSession.mockImplementation(() => {
      callOrder.push('getChatSessionInstance')
      return { restart: mockHelloWorldRestart }
    })

    await restartSession('hello-world')

    expect(callOrder).toEqual(['initRegistry', 'getChatSessionInstance'])
  })
})
