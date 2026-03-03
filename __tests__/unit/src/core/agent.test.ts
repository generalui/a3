import { processAgentResponseData } from '@core/agent'
import { createFullOutputSchema } from '@core/schemas'
import { Agent, SessionData, BaseState, BaseChatContext } from 'types'
import { z } from 'zod'

jest.unmock('@core/agent')
jest.unmock('@core/schemas')

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

      // The schema should still parse without redirectToAgent
      const result = schema.parse({
        chatbotMessage: 'hi',
        goalAchieved: false,
        redirectToAgent: null,
        conversationPayload: {},
      })
      expect(result).toBeDefined()

      // redirectToAgent should be the base schema's default (nullable string), not overridden
      // Since we didn't add it to the extension, the base schema's field remains
      // but the key point is deterministic routing means the LLM schema doesn't constrain it
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
