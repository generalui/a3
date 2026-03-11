import { z } from 'zod'
import { createOpenAIProvider } from '../../../../providers/openai/index'
import type { ProviderRequest } from '../../../../src/types/provider'
import { EventType } from '@ag-ui/client'

jest.unmock('../../../../providers/openai/index')
jest.unmock('../../../../providers/openai/streamProcessor')
jest.unmock('../../../../providers/utils/executeWithFallback')

// Mock OpenAI SDK
const mockCreate = jest.fn()
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  }
})

interface MockCreateArgs {
  model: string
  messages: { role: string; content: string }[]
  response_format: {
    type: string
    json_schema: {
      name: string
      strict: boolean
      schema: Record<string, unknown>
    }
  }
  stream?: boolean
}

function getMockCreateArgs(callIndex: number): MockCreateArgs {
  return (mockCreate.mock.calls as MockCreateArgs[][])[callIndex][0]
}

const testSchema = z.object({
  chatbotMessage: z.string(),
  goalAchieved: z.boolean(),
  conversationPayload: z.object({ userName: z.string().optional() }),
  redirectToAgent: z.string().nullable(),
})

function makeRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }],
    responseSchema: testSchema,
    ...overrides,
  }
}

describe('createOpenAIProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('factory', () => {
    it('should return a provider with name "openai"', () => {
      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      expect(provider.name).toBe('openai')
    })

    it('should expose sendRequest and sendRequestStream methods', () => {
      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      expect(typeof provider.sendRequest).toBe('function')
      expect(typeof provider.sendRequestStream).toBe('function')
    })
  })

  describe('sendRequest (blocking)', () => {
    it('should return parsed content and usage on success', async () => {
      const responseJson = JSON.stringify({
        chatbotMessage: 'Hello!',
        goalAchieved: false,
        conversationPayload: { userName: 'Alice' },
        redirectToAgent: null,
      })

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: responseJson }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      const result = await provider.sendRequest(makeRequest())

      expect(result.content).toBe(responseJson)
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      })
    })

    it('should throw on empty response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      await expect(provider.sendRequest(makeRequest())).rejects.toThrow('OpenAI returned empty response')
    })

    it('should throw on truncated response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"partial":true}' }, finish_reason: 'length' }],
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      await expect(provider.sendRequest(makeRequest())).rejects.toThrow('truncated')
    })

    it('should pass response_format with json_schema to OpenAI', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      await provider.sendRequest(makeRequest())

      const callArgs = getMockCreateArgs(0)
      expect(callArgs.model).toBe('gpt-4o')
      expect(callArgs.response_format.type).toBe('json_schema')
      expect(callArgs.response_format.json_schema.name).toBe('structuredResponse')
      expect(callArgs.response_format.json_schema.strict).toBe(true)
    })

    it('should include system prompt as first message', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      await provider.sendRequest(makeRequest({ systemPrompt: 'Be helpful.' }))

      const callArgs = getMockCreateArgs(0)
      expect(callArgs.messages[0]).toEqual({ role: 'system', content: 'Be helpful.' })
      expect(callArgs.messages[1]).toEqual({ role: 'user', content: 'Hello' })
    })

    it('should handle response with no usage data', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"test":true}' }, finish_reason: 'stop' }],
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      const result = await provider.sendRequest(makeRequest())

      expect(result.usage).toBeUndefined()
    })
  })

  describe('model fallback', () => {
    it('should fall back to the next model on failure', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: '{"fallback":true}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        })

      const provider = createOpenAIProvider({ models: ['gpt-4o', 'gpt-4o-mini'] })
      const result = await provider.sendRequest(makeRequest())

      expect(result.content).toBe('{"fallback":true}')
      expect(mockCreate).toHaveBeenCalledTimes(2)
      const firstCallArgs = getMockCreateArgs(0)
      const secondCallArgs = getMockCreateArgs(1)
      expect(firstCallArgs.model).toBe('gpt-4o')
      expect(secondCallArgs.model).toBe('gpt-4o-mini')
    })

    it('should throw when all models fail', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))

      const provider = createOpenAIProvider({ models: ['gpt-4o', 'gpt-4o-mini'] })
      await expect(provider.sendRequest(makeRequest())).rejects.toThrow('Error 2')
    })
  })

  describe('sendRequestStream', () => {
    it('should yield TEXT_MESSAGE_CONTENT and TOOL_CALL_RESULT events', async () => {
      const json = JSON.stringify({
        chatbotMessage: 'Hi',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      })

      // Mock returns an async iterable (stream)
      mockCreate.mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve()
          yield {
            id: 'chunk-1',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'gpt-4o',
            choices: [{ index: 0, delta: { content: json }, finish_reason: null }],
          }
          yield {
            id: 'chunk-2',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'gpt-4o',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          }
        },
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      const events = []
      for await (const event of provider.sendRequestStream(makeRequest())) {
        events.push(event)
      }

      const textEvents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      expect(textEvents.length).toBeGreaterThan(0)
      const textContent = textEvents.map((e) => (e as { delta: string }).delta).join('')
      expect(textContent).toBe('Hi')

      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)
      expect(toolResult).toBeDefined()
    })

    it('should pass stream: true to OpenAI', async () => {
      mockCreate.mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve()
          yield {
            id: 'chunk-1',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'gpt-4o',
            choices: [{ index: 0, delta: { content: '{"chatbotMessage":"","goalAchieved":false,"conversationPayload":{},"redirectToAgent":null}' }, finish_reason: 'stop' }],
          }
        },
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of provider.sendRequestStream(makeRequest())) {
        // consume
      }

      const callArgs = getMockCreateArgs(0)
      expect(callArgs.stream).toBe(true)
    })
  })

  describe('enforceStrictSchema', () => {
    it('should add additionalProperties: false to the schema sent to OpenAI', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      await provider.sendRequest(makeRequest())

      const callArgs = getMockCreateArgs(0)
      const schema = callArgs.response_format.json_schema.schema

      expect(schema.additionalProperties).toBe(false)
      expect(schema.required).toBeDefined()
      expect(Array.isArray(schema.required)).toBe(true)
    })
  })
})
