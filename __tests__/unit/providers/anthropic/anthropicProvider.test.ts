import { z } from 'zod'
import { createAnthropicProvider } from '../../../../providers/anthropic/index'
import type { ProviderRequest } from '../../../../src/types/provider'
import { EventType } from '@ag-ui/client'

// Mock AI SDK
const mockGenerateText = jest.fn()
const mockStreamText = jest.fn()
jest.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args) as unknown,
  streamText: (...args: unknown[]) => mockStreamText(...args) as unknown,
  Output: { object: ({ schema }: { schema: unknown }) => schema },
}))

// Mock @ai-sdk/anthropic
const mockCreateAnthropic = jest.fn()
jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (...args: unknown[]) => mockCreateAnthropic(...args) as unknown,
}))

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

describe('createAnthropicProvider', () => {
  let mockModelFn: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockModelFn = jest.fn().mockReturnValue('mock-model-instance')
    mockCreateAnthropic.mockReturnValue(mockModelFn)
  })

  describe('factory', () => {
    it('should return a provider with name "anthropic"', () => {
      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      expect(provider.name).toBe('anthropic')
    })

    it('should expose sendRequest and sendRequestStream methods', () => {
      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      expect(typeof provider.sendRequest).toBe('function')
      expect(typeof provider.sendRequestStream).toBe('function')
    })

    it('should pass apiKey and baseURL to createAnthropic', () => {
      createAnthropicProvider({
        models: ['claude-sonnet-4-5-20250929'],
        apiKey: 'sk-ant-test',
        baseURL: 'https://custom.api.com',
      })

      expect(mockCreateAnthropic).toHaveBeenCalledWith({
        apiKey: 'sk-ant-test',
        baseURL: 'https://custom.api.com',
      })
    })
  })

  describe('sendRequest (blocking)', () => {
    it('should return parsed content and usage on success', async () => {
      const responseObj = {
        chatbotMessage: 'Hello!',
        goalAchieved: false,
        conversationPayload: { userName: 'Alice' },
        redirectToAgent: null,
      }

      mockGenerateText.mockResolvedValue({
        output: responseObj,
        usage: { inputTokens: 10, outputTokens: 20 },
      })

      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      const result = await provider.sendRequest(makeRequest())

      expect(result.content).toBe(JSON.stringify(responseObj))
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      })
    })

    it('should pass system prompt and messages to generateText', async () => {
      mockGenerateText.mockResolvedValue({
        output: { chatbotMessage: '', goalAchieved: false, conversationPayload: {}, redirectToAgent: null },
        usage: { inputTokens: 5, outputTokens: 5 },
      })

      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      await provider.sendRequest(makeRequest({ systemPrompt: 'Be helpful.' }))

      const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as Record<string, unknown>
      expect(callArgs.system).toBe('Be helpful.')
      expect(callArgs.messages).toEqual([{ role: 'user', content: 'Hello' }])
    })

    it('should append user message when messages end with assistant role', async () => {
      mockGenerateText.mockResolvedValue({
        output: { chatbotMessage: '', goalAchieved: false, conversationPayload: {}, redirectToAgent: null },
        usage: { inputTokens: 5, outputTokens: 5 },
      })

      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      const request = makeRequest({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      })
      await provider.sendRequest(request)

      const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as Record<string, unknown>
      expect(callArgs.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'Continue' },
      ])
    })

    it('should pass the model instance from the anthropic provider', async () => {
      mockGenerateText.mockResolvedValue({
        output: {},
        usage: { inputTokens: 5, outputTokens: 5 },
      })

      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      await provider.sendRequest(makeRequest())

      expect(mockModelFn).toHaveBeenCalledWith('claude-sonnet-4-5-20250929')
      const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as Record<string, unknown>
      expect(callArgs.model).toBe('mock-model-instance')
    })

    it('should handle undefined token counts gracefully', async () => {
      mockGenerateText.mockResolvedValue({
        output: { chatbotMessage: 'Hi', goalAchieved: false, conversationPayload: {}, redirectToAgent: null },
        usage: { inputTokens: undefined, outputTokens: undefined },
      })

      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      const result = await provider.sendRequest(makeRequest())

      expect(result.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      })
    })
  })

  describe('model fallback', () => {
    it('should fall back to the next model on failure', async () => {
      const responseObj = {
        chatbotMessage: 'Fallback!',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      }

      mockGenerateText.mockRejectedValueOnce(new Error('Rate limited')).mockResolvedValueOnce({
        output: responseObj,
        usage: { inputTokens: 5, outputTokens: 5 },
      })

      const provider = createAnthropicProvider({
        models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
        resilience: { retry: false },
      })
      const result = await provider.sendRequest(makeRequest())

      expect(result.content).toBe(JSON.stringify(responseObj))
      expect(mockGenerateText).toHaveBeenCalledTimes(2)
      expect(mockModelFn).toHaveBeenNthCalledWith(1, 'claude-sonnet-4-5-20250929')
      expect(mockModelFn).toHaveBeenNthCalledWith(2, 'claude-haiku-4-5-20251001')
    })

    it('should throw when all models fail', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('Error 1')).mockRejectedValueOnce(new Error('Error 2'))

      const provider = createAnthropicProvider({
        models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
        resilience: { retry: false },
      })
      await expect(provider.sendRequest(makeRequest())).rejects.toThrow('All models failed')
    })
  })

  describe('sendRequestStream', () => {
    it('should yield TEXT_MESSAGE_CONTENT and TOOL_CALL_RESULT events', async () => {
      const finalObject = {
        chatbotMessage: 'Hi there',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      }

      const partials = [{ chatbotMessage: 'Hi' }, { chatbotMessage: 'Hi there' }]

      let partialIndex = 0
      const mockIterator = {
        next: jest.fn().mockImplementation(() => {
          if (partialIndex < partials.length) {
            return { done: false, value: partials[partialIndex++] }
          }
          return { done: true, value: undefined }
        }),
      }

      const mockPartialOutputStream = {
        [Symbol.asyncIterator]: () => mockIterator,
      }

      mockStreamText.mockReturnValue({
        partialOutputStream: mockPartialOutputStream,
        output: Promise.resolve(finalObject),
      })

      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      const events = []
      for await (const event of provider.sendRequestStream(makeRequest())) {
        events.push(event)
      }

      const textEvents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      expect(textEvents.length).toBeGreaterThan(0)
      const textContent = textEvents.map((e) => (e as { delta: string }).delta).join('')
      expect(textContent).toBe('Hi there')

      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)
      expect(toolResult).toBeDefined()
    })

    it('should pass stream: false implicitly (streamText handles streaming)', async () => {
      const mockIterator = {
        next: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      }

      const mockPartialOutputStream = {
        [Symbol.asyncIterator]: () => mockIterator,
      }

      mockStreamText.mockReturnValue({
        partialOutputStream: mockPartialOutputStream,
        output: Promise.resolve({
          chatbotMessage: '',
          goalAchieved: false,
          conversationPayload: {},
          redirectToAgent: null,
        }),
      })

      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of provider.sendRequestStream(makeRequest())) {
        // consume
      }

      expect(mockStreamText).toHaveBeenCalledTimes(1)
      const callArgs = (mockStreamText.mock.calls as unknown[][])[0][0] as Record<string, unknown>
      expect(callArgs.model).toBe('mock-model-instance')
      expect(callArgs.system).toBe('You are a helpful assistant.')
    })

    it('should append user message when messages end with assistant role', async () => {
      const mockIterator = {
        next: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      }

      const mockPartialOutputStream = {
        [Symbol.asyncIterator]: () => mockIterator,
      }

      mockStreamText.mockReturnValue({
        partialOutputStream: mockPartialOutputStream,
        output: Promise.resolve({
          chatbotMessage: '',
          goalAchieved: false,
          conversationPayload: {},
          redirectToAgent: null,
        }),
      })

      const provider = createAnthropicProvider({ models: ['claude-sonnet-4-5-20250929'] })
      const request = makeRequest({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of provider.sendRequestStream(request)) {
        // consume
      }

      const callArgs = (mockStreamText.mock.calls as unknown[][])[0][0] as Record<string, unknown>
      expect(callArgs.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'Continue' },
      ])
    })
  })
})
