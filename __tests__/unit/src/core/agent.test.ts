import { processAgentResponseData, resolveProvider, prepareAgentRequest, simpleAgentResponseStream } from '@core/agent'
import { createFullOutputSchema } from '@core/schemas'
import { Agent, SessionData, BaseState, BaseChatContext, Provider, StreamEvent } from 'types'
import { EventType } from '@ag-ui/client'
import { z } from 'zod'

jest.unmock('@core/agent')
jest.unmock('@core/schemas')

jest.mock('@prompts/basePrompt', () => ({
  basePrompt: jest.fn().mockReturnValue(' [base]'),
}))
jest.mock('@prompts/widgetPrompt', () => ({
  widgetPrompt: jest.fn().mockReturnValue(''),
}))

interface TestState extends BaseState {
  userName?: string
}

const createMockSessionData = (state: Partial<TestState> = {}): SessionData<TestState, BaseChatContext> =>
  ({
    sessionId: 'test-session',
    activeAgentId: 'test-agent',
    state: { userName: undefined, ...state } as TestState,
    messages: [],
    context: {},
    chatContext: {},
  }) as SessionData<TestState, BaseChatContext>

const createMockAgent = (overrides: Partial<Agent<TestState>> = {}): Agent<TestState> => ({
  id: 'test-agent',
  prompt: 'test prompt',
  outputSchema: z.object({ userName: z.string().optional() }),
  ...overrides,
})

const createMockProvider = (): Provider => ({
  name: 'mock-provider',
  sendRequest: jest.fn(),
  sendRequestStream: jest.fn(),
})

describe('processAgentResponseData', () => {
  const baseData = {
    chatbotMessage: 'Hello!',
    goalAchieved: false,
    conversationPayload: { userName: 'Alice' },
    redirectToAgent: null,
    widgets: {},
  }

  describe('transition as a function (deterministic routing)', () => {
    it('should use the function result as nextAgentId', () => {
      const agent = createMockAgent({
        transition: (_state, goalAchieved) => (goalAchieved ? 'next' : 'current'),
      })
      const sessionData = createMockSessionData()
      const data = { ...baseData, goalAchieved: true }

      const result = processAgentResponseData(agent, sessionData, data)

      expect(result.nextAgentId).toBe('next')
    })

    it('should ignore redirectToAgent from LLM when transition is a function', () => {
      const agent = createMockAgent({
        transition: (_state, _goalAchieved) => 'code-decided',
      })
      const sessionData = createMockSessionData()
      const data = { ...baseData, redirectToAgent: 'llm-decided' }

      const result = processAgentResponseData(agent, sessionData, data)

      expect(result.nextAgentId).toBe('code-decided')
    })

    it('should pass updated state to the transition function', () => {
      const transitionFn = jest.fn((_state: TestState, _goalAchieved: boolean) => 'next')
      const agent = createMockAgent({
        transition: transitionFn,
        setState: (data, state) => ({ ...state, ...(data as Record<string, unknown>) }) as TestState,
      })
      const sessionData = createMockSessionData()
      const data = { ...baseData, conversationPayload: { userName: 'Bob' } }

      processAgentResponseData(agent, sessionData, data)

      expect(transitionFn).toHaveBeenCalledWith(expect.objectContaining({ userName: 'Bob' }), false)
    })
  })

  describe('transition as an array (non-deterministic routing)', () => {
    it('should use redirectToAgent from LLM response', () => {
      const agent = createMockAgent({
        transition: ['billing', 'support'],
      })
      const sessionData = createMockSessionData()
      const data = { ...baseData, redirectToAgent: 'billing' }

      const result = processAgentResponseData(agent, sessionData, data)

      expect(result.nextAgentId).toBe('billing')
    })

    it('should stay on current agent when redirectToAgent is null', () => {
      const agent = createMockAgent({
        transition: ['billing', 'support'],
      })
      const sessionData = createMockSessionData()
      const data = { ...baseData, redirectToAgent: null }

      const result = processAgentResponseData(agent, sessionData, data)

      expect(result.nextAgentId).toBe('test-agent')
    })
  })

  describe('transition absent', () => {
    it('should use redirectToAgent from LLM response', () => {
      const agent = createMockAgent()
      const sessionData = createMockSessionData()
      const data = { ...baseData, redirectToAgent: 'some-agent' }

      const result = processAgentResponseData(agent, sessionData, data)

      expect(result.nextAgentId).toBe('some-agent')
    })

    it('should stay on current agent when no redirect and no transition', () => {
      const agent = createMockAgent()
      const sessionData = createMockSessionData()
      const data = { ...baseData, redirectToAgent: null }

      const result = processAgentResponseData(agent, sessionData, data)

      expect(result.nextAgentId).toBe('test-agent')
    })
  })

  describe('state and message extraction', () => {
    it('should shallow merge conversationPayload into state by default', () => {
      const agent = createMockAgent()
      const sessionData = createMockSessionData({ userName: 'Old' })
      const data = { ...baseData, conversationPayload: { userName: 'New' } }

      const result = processAgentResponseData(agent, sessionData, data)

      expect(result.newState.userName).toBe('New')
    })

    it('should use custom setState when provided', () => {
      const agent = createMockAgent({
        setState: (_data, _state) => ({ userName: 'Custom' }) as TestState,
      })
      const sessionData = createMockSessionData()

      const result = processAgentResponseData(agent, sessionData, baseData)

      expect(result.newState.userName).toBe('Custom')
    })

    it('should strip empty widget objects', () => {
      const agent = createMockAgent()
      const sessionData = createMockSessionData()
      const data = { ...baseData, widgets: {} }

      const result = processAgentResponseData(agent, sessionData, data)

      expect(result.widgets).toBeUndefined()
    })
  })
})

describe('createFullOutputSchema', () => {
  const testSchema = z.object({ userName: z.string().optional() })

  describe('with transition targets (array mode)', () => {
    it('should constrain redirectToAgent to enum values', () => {
      const schema = createFullOutputSchema(testSchema, ['billing', 'support'])
      const shape = schema.shape

      expect(shape.redirectToAgent).toBeDefined()

      // Valid: should parse without error
      const validResult = schema.parse({
        chatbotMessage: 'hi',
        goalAchieved: false,
        redirectToAgent: 'billing',
        conversationPayload: {},
      })
      expect(validResult.redirectToAgent).toBe('billing')
    })

    it('should reject agent IDs not in the transition targets', () => {
      const schema = createFullOutputSchema(testSchema, ['billing', 'support'])

      expect(() =>
        schema.parse({
          chatbotMessage: 'hi',
          goalAchieved: false,
          redirectToAgent: 'unknown-agent',
          conversationPayload: {},
        }),
      ).toThrow()
    })
  })

  describe('without transition targets', () => {
    it('should allow any string for redirectToAgent', () => {
      const schema = createFullOutputSchema(testSchema)

      const result = schema.parse({
        chatbotMessage: 'hi',
        goalAchieved: false,
        redirectToAgent: 'any-agent-id',
        conversationPayload: {},
      })
      expect(result.redirectToAgent).toBe('any-agent-id')
    })
  })

  describe('with deterministic routing', () => {
    it('should NOT include redirectToAgent in the schema', () => {
      const schema = createFullOutputSchema(testSchema, undefined, undefined, true)

      const result = schema.parse({
        chatbotMessage: 'hi',
        goalAchieved: false,
        redirectToAgent: null,
        conversationPayload: {},
      })

      // Zod strips unknown keys — redirectToAgent is absent from the result entirely
      expect('redirectToAgent' in result).toBe(false)
    })

    it('should still include conversationPayload and other fields', () => {
      const schema = createFullOutputSchema(testSchema, undefined, undefined, true)

      const result = schema.parse({
        chatbotMessage: 'test message',
        goalAchieved: true,
        redirectToAgent: null,
        conversationPayload: { userName: 'Alice' },
      })
      expect(result.chatbotMessage).toBe('test message')
      expect(result.goalAchieved).toBe(true)
      expect(result.conversationPayload).toEqual({ userName: 'Alice' })
    })
  })
})

// ── resolveProvider ───────────────────────────────────────────────────────────

describe('resolveProvider', () => {
  it('returns the agent-level provider when the agent has its own', () => {
    const agentProvider = createMockProvider()
    const sessionProvider = createMockProvider()
    const agent = createMockAgent({ provider: agentProvider })

    expect(resolveProvider(agent, sessionProvider)).toBe(agentProvider)
  })

  it('falls back to the session provider when the agent has no provider', () => {
    const sessionProvider = createMockProvider()
    const agent = createMockAgent()

    expect(resolveProvider(agent, sessionProvider)).toBe(sessionProvider)
  })
})

// ── prepareAgentRequest ───────────────────────────────────────────────────────

describe('prepareAgentRequest', () => {
  it('uses a string prompt directly', async () => {
    const agent = createMockAgent({ prompt: 'You are helpful.' })
    const input = { agent, sessionData: createMockSessionData(), stream: false, provider: createMockProvider() }

    const { systemPrompt } = await prepareAgentRequest(input)

    expect(systemPrompt).toContain('You are helpful.')
  })

  it('calls a function prompt with the flow input and uses the result', async () => {
    const promptFn = jest.fn().mockResolvedValue('Dynamic prompt text')
    const agent = createMockAgent({ prompt: promptFn })
    const input = { agent, sessionData: createMockSessionData(), stream: false, provider: createMockProvider() }

    const { systemPrompt } = await prepareAgentRequest(input)

    expect(promptFn).toHaveBeenCalledWith(input)
    expect(systemPrompt).toContain('Dynamic prompt text')
  })

  it('injects transition context when lastAgentUnsentMessage is provided', async () => {
    const agent = createMockAgent()
    const input = {
      agent,
      sessionData: createMockSessionData(),
      lastAgentUnsentMessage: 'Previous agent said this',
      stream: false,
      provider: createMockProvider(),
    }

    const { systemPrompt } = await prepareAgentRequest(input)

    expect(systemPrompt).toContain('[Transition Context]')
    expect(systemPrompt).toContain('Previous agent said this')
  })

  it('omits transition context when lastAgentUnsentMessage is absent', async () => {
    const agent = createMockAgent()
    const input = { agent, sessionData: createMockSessionData(), stream: false, provider: createMockProvider() }

    const { systemPrompt } = await prepareAgentRequest(input)

    expect(systemPrompt).not.toContain('[Transition Context]')
  })

  it('excludes redirectToAgent from schema when transition is a function (deterministic routing)', async () => {
    const agent = createMockAgent({ transition: (_state, _goal) => 'next-agent' })
    const input = { agent, sessionData: createMockSessionData(), stream: false, provider: createMockProvider() }

    const { fullOutputSchema } = await prepareAgentRequest(input)

    expect('redirectToAgent' in fullOutputSchema.shape).toBe(false)
  })

  it('excludes redirectToAgent from schema when lastAgentUnsentMessage is set (suppress redirect)', async () => {
    const agent = createMockAgent({ transition: ['billing', 'support'] })
    const input = {
      agent,
      sessionData: createMockSessionData(),
      lastAgentUnsentMessage: 'Previous message',
      stream: false,
      provider: createMockProvider(),
    }

    const { fullOutputSchema } = await prepareAgentRequest(input)

    expect('redirectToAgent' in fullOutputSchema.shape).toBe(false)
  })

  it('includes redirectToAgent as an enum when transition is an array and no lastAgentUnsentMessage', async () => {
    const agent = createMockAgent({ transition: ['billing', 'support'] })
    const input = { agent, sessionData: createMockSessionData(), stream: false, provider: createMockProvider() }

    const { fullOutputSchema } = await prepareAgentRequest(input)

    expect('redirectToAgent' in fullOutputSchema.shape).toBe(true)
    // Should reject values outside the transition targets
    expect(() =>
      fullOutputSchema.parse({
        chatbotMessage: 'hi',
        goalAchieved: false,
        redirectToAgent: 'unknown-agent',
        conversationPayload: {},
      }),
    ).toThrow()
  })

  it('calls a function outputSchema with sessionData', async () => {
    const schemaFn = jest.fn().mockReturnValue(z.object({ userName: z.string().optional() }))
    const agent = createMockAgent({ outputSchema: schemaFn })
    const sessionData = createMockSessionData()
    const input = { agent, sessionData, stream: false, provider: createMockProvider() }

    await prepareAgentRequest(input)

    expect(schemaFn).toHaveBeenCalledWith(sessionData)
  })
})

// ── simpleAgentResponseStream ─────────────────────────────────────────────────

describe('simpleAgentResponseStream', () => {
  async function collectStreamEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
    const events: T[] = []
    for await (const event of gen) {
      events.push(event)
    }
    return events
  }

  const toolCallContent = {
    chatbotMessage: 'Hello!',
    goalAchieved: false,
    redirectToAgent: null,
    conversationPayload: { userName: 'Alice' },
    widgets: {},
  }

  function makeStreamingProvider(upstreamEvents: StreamEvent<TestState>[]): Provider {
    return {
      name: 'mock-stream-provider',
      sendRequest: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/require-await
      sendRequestStream: async function* () {
        yield* upstreamEvents
        yield {
          type: EventType.TOOL_CALL_RESULT,
          toolCallId: 'tool-1',
          messageId: 'msg-final',
          content: JSON.stringify(toolCallContent),
        } as StreamEvent<TestState>
      } as unknown as Provider['sendRequestStream'],
    }
  }

  it('wraps text content with TEXT_MESSAGE_START/END and a consistent messageId', async () => {
    const provider = makeStreamingProvider([
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'ignored', delta: 'Hello' },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'ignored', delta: ' world' },
    ])
    const events = await collectStreamEvents(
      simpleAgentResponseStream({
        agent: createMockAgent(),
        sessionData: createMockSessionData(),
        stream: true,
        provider,
      }),
    )

    const start = events.find((e) => e.type === EventType.TEXT_MESSAGE_START) as {
      type: EventType.TEXT_MESSAGE_START
      messageId: string
    }
    const end = events.find((e) => e.type === EventType.TEXT_MESSAGE_END) as { messageId: string }
    const contents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT) as { messageId: string }[]

    expect(start).toBeDefined()
    expect(end).toBeDefined()
    expect(start.messageId).toBeTruthy()
    contents.forEach((e) => expect(e.messageId).toBe(start.messageId))
    expect(end.messageId).toBe(start.messageId)
  })

  it('yields TEXT_MESSAGE_END before TOOL_CALL_RESULT', async () => {
    const provider = makeStreamingProvider([
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'ignored', delta: 'Hello' },
    ])
    const events = await collectStreamEvents(
      simpleAgentResponseStream({
        agent: createMockAgent(),
        sessionData: createMockSessionData(),
        stream: true,
        provider,
      }),
    )

    const endIdx = events.findIndex((e) => e.type === EventType.TEXT_MESSAGE_END)
    const resultIdx = events.findIndex((e) => e.type === EventType.TOOL_CALL_RESULT)

    expect(endIdx).toBeGreaterThanOrEqual(0)
    expect(endIdx).toBeLessThan(resultIdx)
  })

  it('closes an open text message before a RUN_ERROR event', async () => {
    const provider: Provider = {
      name: 'mock-stream-provider',
      sendRequest: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/require-await
      sendRequestStream: async function* () {
        yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'ignored', delta: 'partial' } as StreamEvent<TestState>
        yield { type: EventType.RUN_ERROR, message: 'Something failed' } as StreamEvent<TestState>
        yield {
          type: EventType.TOOL_CALL_RESULT,
          toolCallId: 'tool-1',
          messageId: 'msg-final',
          content: JSON.stringify(toolCallContent),
        } as StreamEvent<TestState>
      } as unknown as Provider['sendRequestStream'],
    }
    const events = await collectStreamEvents(
      simpleAgentResponseStream({
        agent: createMockAgent(),
        sessionData: createMockSessionData(),
        stream: true,
        provider,
      }),
    )

    const endIdx = events.findIndex((e) => e.type === EventType.TEXT_MESSAGE_END)
    const errorIdx = events.findIndex((e) => e.type === EventType.RUN_ERROR)

    expect(endIdx).toBeGreaterThanOrEqual(0)
    expect(endIdx).toBeLessThan(errorIdx)
  })

  it('does not emit TEXT_MESSAGE_START when there are no text content events', async () => {
    const provider = makeStreamingProvider([])
    const events = await collectStreamEvents(
      simpleAgentResponseStream({
        agent: createMockAgent(),
        sessionData: createMockSessionData(),
        stream: true,
        provider,
      }),
    )

    expect(events.every((e) => e.type !== EventType.TEXT_MESSAGE_START)).toBe(true)
    expect(events.some((e) => e.type === EventType.TOOL_CALL_RESULT)).toBe(true)
  })

  it('throws when the stream completes without a TOOL_CALL_RESULT', async () => {
    const provider: Provider = {
      name: 'mock-stream-provider',
      sendRequest: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/require-await
      sendRequestStream: async function* () {
        yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'ignored', delta: 'Hello' } as StreamEvent<TestState>
      } as unknown as Provider['sendRequestStream'],
    }

    await expect(
      collectStreamEvents(
        simpleAgentResponseStream({
          agent: createMockAgent(),
          sessionData: createMockSessionData(),
          stream: true,
          provider,
        }),
      ),
    ).rejects.toThrow('Stream completed without tool call data')
  })
})
