import { manageFlow, manageFlowStream, STREAM_REQUIRED_ERROR, BLOCKING_REQUIRED_ERROR } from '@core/chatFlow'
import { AgentRegistry } from '@core/AgentRegistry'
import { EventType } from '@ag-ui/client'
import {
  Agent,
  AgentResponseResult,
  SessionData,
  BaseState,
  BaseChatContext,
  StreamEvent,
  Provider,
} from 'types'
import { z } from 'zod'

jest.unmock('@core/chatFlow')

// ── helpers ──────────────────────────────────────────────────────────────────

interface TestState extends BaseState {
  userName?: string
}

const mockAgentResult: AgentResponseResult<TestState> = {
  newState: { userName: 'Alice' },
  chatbotMessage: 'Hello!',
  goalAchieved: false,
  nextAgentId: 'test-agent',
}

const createMockProvider = (): Provider => ({
  name: 'mock-provider',
  sendRequest: jest.fn(),
  sendRequestStream: jest.fn(),
})

const createMockSessionData = (): SessionData<TestState, BaseChatContext> =>
  ({
    sessionId: 'test-session',
    activeAgentId: 'test-agent',
    state: { userName: undefined } as TestState,
    messages: [],
    context: {},
    chatContext: {},
  }) as SessionData<TestState, BaseChatContext>

const createMockAgent = (
  generateResponse: Agent<TestState>['generateResponse'],
): Agent<TestState> => ({
  id: 'test-agent',
  prompt: 'test prompt',
  outputSchema: z.object({ userName: z.string().optional() }),
  generateResponse,
})

// ── tests ────────────────────────────────────────────────────────────────────

describe('validateGenerateResponseResult', () => {
  beforeEach(() => {
    AgentRegistry.resetInstance()
  })

  // ── manageFlow (blocking path) ──────────────────────────────────────────

  describe('manageFlow (blocking, stream = false)', () => {
    it('should throw when generateResponse returns an AsyncGenerator', async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const agent = createMockAgent(async function* () {
        yield { type: EventType.RUN_STARTED } as StreamEvent<TestState>
        return mockAgentResult
      })

      AgentRegistry.getInstance<TestState>().register(agent)

      await expect(
        manageFlow({
          agent,
          sessionData: createMockSessionData(),
          stream: false,
          provider: createMockProvider(),
        }),
      ).rejects.toThrow(BLOCKING_REQUIRED_ERROR('test-agent'))
    })

    it('should throw when generateResponse returns a Promise but stream = true', async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const agent = createMockAgent(async () => mockAgentResult)

      AgentRegistry.getInstance<TestState>().register(agent)

      await expect(
        manageFlow({
          agent,
          sessionData: createMockSessionData(),
          stream: true,
          provider: createMockProvider(),
        }),
      ).rejects.toThrow(STREAM_REQUIRED_ERROR('test-agent'))
    })

    it('should succeed when generateResponse returns a Promise and stream = false', async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const agent = createMockAgent(async () => mockAgentResult)

      AgentRegistry.getInstance<TestState>().register(agent)

      const result = await manageFlow({
        agent,
        sessionData: createMockSessionData(),
        stream: false,
        provider: createMockProvider(),
      })

      expect(result.responseMessage).toBe('Hello!')
      expect(result.activeAgentId).toBe('test-agent')
    })
  })

  // ── manageFlowStream (streaming path) ───────────────────────────────────

  describe('manageFlowStream (streaming, stream = true)', () => {
    /** Helper to drain the async generator and collect all events. */
    async function collectStream<T>(gen: AsyncGenerator<T>): Promise<T[]> {
      const events: T[] = []
      for await (const event of gen) {
        events.push(event)
      }
      return events
    }

    it('should throw when generateResponse returns a Promise but stream = true', async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const agent = createMockAgent(async () => mockAgentResult)

      AgentRegistry.getInstance<TestState>().register(agent)

      const gen = manageFlowStream<TestState>({
        agent,
        sessionData: createMockSessionData(),
        stream: true,
        provider: createMockProvider(),
      })

      await expect(collectStream(gen)).rejects.toThrow(STREAM_REQUIRED_ERROR('test-agent'))
    })

    it('should throw when generateResponse returns an AsyncGenerator but stream = false', async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const agent = createMockAgent(async function* () {
        yield { type: EventType.RUN_STARTED } as StreamEvent<TestState>
        return mockAgentResult
      })

      AgentRegistry.getInstance<TestState>().register(agent)

      const gen = manageFlowStream<TestState>({
        agent,
        sessionData: createMockSessionData(),
        stream: false,
        provider: createMockProvider(),
      })

      await expect(collectStream(gen)).rejects.toThrow(BLOCKING_REQUIRED_ERROR('test-agent'))
    })

    it('should succeed when generateResponse returns an AsyncGenerator and stream = true', async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const agent = createMockAgent(async function* () {
        yield { type: EventType.RUN_STARTED } as StreamEvent<TestState>
        return mockAgentResult
      })

      AgentRegistry.getInstance<TestState>().register(agent)

      const gen = manageFlowStream<TestState>({
        agent,
        sessionData: createMockSessionData(),
        stream: true,
        provider: createMockProvider(),
      })

      const events = await collectStream(gen)

      // Should have yielded at least the RUN_STARTED event and the final RUN_FINISHED event
      expect(events.length).toBeGreaterThanOrEqual(2)
      expect(events[0]).toEqual(expect.objectContaining({ type: EventType.RUN_STARTED }))
      expect(events[events.length - 1]).toEqual(expect.objectContaining({ type: EventType.RUN_FINISHED }))
    })
  })
})
