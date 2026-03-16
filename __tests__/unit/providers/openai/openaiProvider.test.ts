import { z } from 'zod'
import { createOpenAIProvider } from '../../../../providers/openai/index'
import type { ProviderRequest } from '../../../../src/types/provider'
import { EventType } from '@ag-ui/client'

// Mock AI SDK
const mockGenerateText = jest.fn()
const mockStreamText = jest.fn()
jest.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args) as unknown,
  streamText: (...args: unknown[]) => mockStreamText(...args) as unknown,
  Output: { object: ({ schema }: { schema: unknown }) => schema },
  jsonSchema: (schema: unknown) => schema, // pass-through for testing
}))

// Mock @ai-sdk/openai
const mockCreateOpenAI = jest.fn()
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => mockCreateOpenAI(...args) as unknown,
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

describe('createOpenAIProvider', () => {
  let mockModelFn: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockModelFn = jest.fn().mockReturnValue('mock-model-instance')
    mockCreateOpenAI.mockReturnValue(mockModelFn)
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

    it('should pass apiKey, baseURL, and organization to createOpenAI', () => {
      createOpenAIProvider({
        models: ['gpt-4o'],
        apiKey: 'sk-test',
        baseURL: 'https://custom.api.com',
        organization: 'org-123',
      })

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test',
        baseURL: 'https://custom.api.com',
        organization: 'org-123',
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

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
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

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      await provider.sendRequest(makeRequest({ systemPrompt: 'Be helpful.' }))

      const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as Record<string, unknown>
      expect(callArgs.system).toBe('Be helpful.')
      expect(callArgs.messages).toEqual([{ role: 'user', content: 'Hello' }])
    })

    it('should pass the model instance from the openai provider', async () => {
      mockGenerateText.mockResolvedValue({
        output: {},
        usage: { inputTokens: 5, outputTokens: 5 },
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      await provider.sendRequest(makeRequest())

      expect(mockModelFn).toHaveBeenCalledWith('gpt-4o')
      const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as Record<string, unknown>
      expect(callArgs.model).toBe('mock-model-instance')
    })

    it('should handle undefined token counts gracefully', async () => {
      mockGenerateText.mockResolvedValue({
        output: { chatbotMessage: 'Hi', goalAchieved: false, conversationPayload: {}, redirectToAgent: null },
        usage: { inputTokens: undefined, outputTokens: undefined },
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      const result = await provider.sendRequest(makeRequest())

      expect(result.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      })
    })

    it('should enforce strict JSON schema (additionalProperties: false, all properties required)', async () => {
      mockGenerateText.mockResolvedValue({
        output: { chatbotMessage: '', goalAchieved: false, conversationPayload: {}, redirectToAgent: null },
        usage: { inputTokens: 5, outputTokens: 5 },
      })

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      await provider.sendRequest(makeRequest())

      const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as Record<string, unknown>
      const schema = callArgs.output as Record<string, unknown>

      // Top-level object must have additionalProperties: false and all props required
      expect(schema.additionalProperties).toBe(false)
      expect(Array.isArray(schema.required)).toBe(true)

      // Nested conversationPayload object must also have userName in required
      const props = schema.properties as Record<string, Record<string, unknown>>
      const convPayload = props.conversationPayload
      expect(convPayload.additionalProperties).toBe(false)
      expect(convPayload.required as string[]).toContain('userName')
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

      const provider = createOpenAIProvider({
        models: ['gpt-4o', 'gpt-4o-mini'],
        resilience: { retry: false },
      })
      const result = await provider.sendRequest(makeRequest())

      expect(result.content).toBe(JSON.stringify(responseObj))
      expect(mockGenerateText).toHaveBeenCalledTimes(2)
      expect(mockModelFn).toHaveBeenNthCalledWith(1, 'gpt-4o')
      expect(mockModelFn).toHaveBeenNthCalledWith(2, 'gpt-4o-mini')
    })

    it('should throw when all models fail', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('Error 1')).mockRejectedValueOnce(new Error('Error 2'))

      const provider = createOpenAIProvider({
        models: ['gpt-4o', 'gpt-4o-mini'],
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

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
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

    it('should pass model and system prompt to streamText', async () => {
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

      const provider = createOpenAIProvider({ models: ['gpt-4o'] })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of provider.sendRequestStream(makeRequest())) {
        // consume
      }

      expect(mockStreamText).toHaveBeenCalledTimes(1)
      const callArgs = (mockStreamText.mock.calls as unknown[][])[0][0] as Record<string, unknown>
      expect(callArgs.model).toBe('mock-model-instance')
      expect(callArgs.system).toBe('You are a helpful assistant.')
    })
  })
})
