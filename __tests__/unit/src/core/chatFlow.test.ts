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

// ── shared helpers ────────────────────────────────────────────────────────────

async function collectStream<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

describe('manageFlow / manageFlowStream — stream mode validation', () => {
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

// ── manageFlow — agent routing ────────────────────────────────────────────────

describe('manageFlow — agent routing', () => {
  beforeEach(() => {
    AgentRegistry.resetInstance()
  })

  it('returns No active agent when activeAgentId is not in the registry', async () => {
    const sessionData = {
      ...createMockSessionData(),
      activeAgentId: 'unknown-agent',
    } as SessionData<TestState, BaseChatContext>

    const result = await manageFlow({
      // eslint-disable-next-line @typescript-eslint/require-await
      agent: createMockAgent(async () => mockAgentResult),
      sessionData,
      stream: false,
      provider: createMockProvider(),
    })

    expect(result.responseMessage).toBe('No active agent')
    expect(result.activeAgentId).toBeNull()
    expect(result.goalAchieved).toBe(false)
  })

  it('transitions to the next agent and returns its response', async () => {
    const agentA: Agent<TestState> = {
      id: 'agent-a',
      prompt: 'Agent A',
      outputSchema: z.object({}),
      // eslint-disable-next-line @typescript-eslint/require-await
      generateResponse: async () => ({
        newState: {} as TestState,
        chatbotMessage: 'From A',
        goalAchieved: false,
        nextAgentId: 'agent-b',
      }),
    }
    const agentB: Agent<TestState> = {
      id: 'agent-b',
      prompt: 'Agent B',
      outputSchema: z.object({}),
      // eslint-disable-next-line @typescript-eslint/require-await
      generateResponse: async () => ({
        newState: {} as TestState,
        chatbotMessage: 'From B',
        goalAchieved: true,
        nextAgentId: 'agent-b',
      }),
    }
    AgentRegistry.getInstance<TestState>().register([agentA, agentB])

    const result = await manageFlow({
      agent: agentA,
      sessionData: { ...createMockSessionData(), activeAgentId: 'agent-a' } as SessionData<TestState, BaseChatContext>,
      stream: false,
      provider: createMockProvider(),
    })

    expect(result.responseMessage).toBe('From B')
    expect(result.activeAgentId).toBe('agent-b')
  })

  it('stops at MAX_AUTO_TRANSITIONS depth and returns from the current agent', async () => {
    const agentA: Agent<TestState> = {
      id: 'agent-a',
      prompt: 'Agent A',
      outputSchema: z.object({}),
      // eslint-disable-next-line @typescript-eslint/require-await
      generateResponse: async () => ({
        newState: {} as TestState,
        chatbotMessage: 'Capped at A',
        goalAchieved: false,
        nextAgentId: 'agent-b',
      }),
    }
    const agentB: Agent<TestState> = {
      id: 'agent-b',
      prompt: 'Agent B',
      outputSchema: z.object({}),
      // eslint-disable-next-line @typescript-eslint/require-await
      generateResponse: async () => ({
        newState: {} as TestState,
        chatbotMessage: 'From B',
        goalAchieved: false,
        nextAgentId: 'agent-a',
      }),
    }
    AgentRegistry.getInstance<TestState>().register([agentA, agentB])

    const result = await manageFlow({
      agent: agentA,
      sessionData: { ...createMockSessionData(), activeAgentId: 'agent-a' } as SessionData<TestState, BaseChatContext>,
      stream: false,
      provider: createMockProvider(),
      _depth: 10,
    })

    // Transition blocked — response from agent-a, nextAgentId still points to agent-b
    expect(result.responseMessage).toBe('Capped at A')
    expect(result.activeAgentId).toBe('agent-a')
    expect(result.nextAgentId).toBe('agent-b')
  })
})

// ── manageFlowStream — agent routing ──────────────────────────────────────────

describe('manageFlowStream — agent routing', () => {
  beforeEach(() => {
    AgentRegistry.resetInstance()
  })

  it('yields a single RUN_FINISHED with No active agent when activeAgentId is not in the registry', async () => {
    const sessionData = {
      ...createMockSessionData(),
      activeAgentId: 'unknown-agent',
    } as SessionData<TestState, BaseChatContext>

    const events = await collectStream(
      manageFlowStream<TestState>({
        // eslint-disable-next-line @typescript-eslint/require-await, require-yield
        agent: createMockAgent(async function* () {
          return mockAgentResult
        }),
        sessionData,
        stream: true,
        provider: createMockProvider(),
      }),
    )

    expect(events).toHaveLength(1)
    const finished = events[0] as { type: EventType; result?: { responseMessage: string } }
    expect(finished.type).toBe(EventType.RUN_FINISHED)
    expect(finished.result?.responseMessage).toBe('No active agent')
  })

  it('yields a CUSTOM AgentTransition event when handing off between agents', async () => {
    const agentA: Agent<TestState> = {
      id: 'agent-a',
      prompt: 'Agent A',
      outputSchema: z.object({}),
      // eslint-disable-next-line @typescript-eslint/require-await, require-yield, object-shorthand
      generateResponse: async function* () {
        return { newState: {} as TestState, chatbotMessage: 'Handing off', goalAchieved: false, nextAgentId: 'agent-b' }
      },
    }
    const agentB: Agent<TestState> = {
      id: 'agent-b',
      prompt: 'Agent B',
      outputSchema: z.object({}),
      // eslint-disable-next-line @typescript-eslint/require-await, require-yield, object-shorthand
      generateResponse: async function* () {
        return { newState: {} as TestState, chatbotMessage: 'Handled', goalAchieved: true, nextAgentId: 'agent-b' }
      },
    }
    AgentRegistry.getInstance<TestState>().register([agentA, agentB])

    const events = await collectStream(
      manageFlowStream<TestState>({
        agent: agentA,
        sessionData: { ...createMockSessionData(), activeAgentId: 'agent-a' } as SessionData<TestState, BaseChatContext>,
        stream: true,
        provider: createMockProvider(),
      }),
    )

    const transition = events.find(
      (e) => (e as { type: EventType }).type === EventType.CUSTOM,
    ) as { type: EventType; name: string; value: { fromAgentId: string; toAgentId: string } } | undefined

    expect(transition).toBeDefined()
    expect(transition?.name).toBe('AgentTransition')
    expect(transition?.value.fromAgentId).toBe('agent-a')
    expect(transition?.value.toAgentId).toBe('agent-b')
  })

  it('ends with RUN_FINISHED carrying the final transitioned-to agent response', async () => {
    const agentA: Agent<TestState> = {
      id: 'agent-a',
      prompt: 'Agent A',
      outputSchema: z.object({}),
      // eslint-disable-next-line @typescript-eslint/require-await, require-yield, object-shorthand
      generateResponse: async function* () {
        return { newState: {} as TestState, chatbotMessage: 'From A', goalAchieved: false, nextAgentId: 'agent-b' }
      },
    }
    const agentB: Agent<TestState> = {
      id: 'agent-b',
      prompt: 'Agent B',
      outputSchema: z.object({}),
      // eslint-disable-next-line @typescript-eslint/require-await, require-yield, object-shorthand
      generateResponse: async function* () {
        return { newState: {} as TestState, chatbotMessage: 'Final from B', goalAchieved: true, nextAgentId: 'agent-b' }
      },
    }
    AgentRegistry.getInstance<TestState>().register([agentA, agentB])

    const events = await collectStream(
      manageFlowStream<TestState>({
        agent: agentA,
        sessionData: { ...createMockSessionData(), activeAgentId: 'agent-a' } as SessionData<TestState, BaseChatContext>,
        stream: true,
        provider: createMockProvider(),
      }),
    )

    const last = events[events.length - 1] as {
      type: EventType
      result?: { responseMessage: string; activeAgentId: string }
    }
    expect(last.type).toBe(EventType.RUN_FINISHED)
    expect(last.result?.responseMessage).toBe('Final from B')
    expect(last.result?.activeAgentId).toBe('agent-b')
  })
})
