import { z } from 'zod'
import { createBedrockProvider } from '@providers/bedrock/index'
import type { ProviderRequest } from 'types/provider'
import { A3ResilienceError } from '@errors/resilience'
import { EventType } from '@ag-ui/client'

// Mock AWS Bedrock SDK
const mockSend = jest.fn()
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ConverseCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
  ConverseStreamCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}))

interface MockSendInput {
  system: { text: string }[]
  messages: { role: string; content: { text: string }[] }[]
  toolConfig: {
    tools: { toolSpec: { name: string } }[]
    toolChoice: Record<string, Record<string, never>>
  }
  modelId: string
}

function getMockSendInput(callIndex: number): MockSendInput {
  return (mockSend.mock.calls as { input: MockSendInput }[][])[callIndex][0].input
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

describe('createBedrockProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('factory', () => {
    it('should return a provider with name "bedrock"', () => {
      const provider = createBedrockProvider({ models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'] })
      expect(provider.name).toBe('bedrock')
    })

    it('should expose sendRequest and sendRequestStream methods', () => {
      const provider = createBedrockProvider({ models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'] })
      expect(typeof provider.sendRequest).toBe('function')
      expect(typeof provider.sendRequestStream).toBe('function')
    })
  })

  describe('sendRequest (blocking)', () => {
    it('should return parsed content and usage on successful tool response', async () => {
      const toolResponse = {
        chatbotMessage: 'Hello!',
        goalAchieved: false,
        conversationPayload: { userName: 'Alice' },
        redirectToAgent: null,
      }

      mockSend.mockResolvedValue({
        output: {
          message: {
            content: [{ toolUse: { input: toolResponse } }],
          },
        },
        usage: { inputTokens: 100, outputTokens: 50 },
      })

      const provider = createBedrockProvider({ models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'] })
      const result = await provider.sendRequest(makeRequest())

      const parsed = JSON.parse(result.content) as Record<string, unknown>
      expect(parsed.chatbotMessage).toBe('Hello!')
      expect((parsed.conversationPayload as Record<string, unknown>).userName).toBe('Alice')
      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      })
    })

    it('should throw on invalid tool response (missing chatbotMessage)', async () => {
      mockSend.mockResolvedValue({
        output: {
          message: {
            content: [{ toolUse: { input: { invalid: true } } }],
          },
        },
      })

      const provider = createBedrockProvider({
        models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
        resilience: { retry: false },
      })
      try {
        await provider.sendRequest(makeRequest())
        fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(A3ResilienceError)
        expect((err as A3ResilienceError).errors[0].error.message).toMatch('invalid tool response')
      }
    })

    it('should throw on response with no tool use block', async () => {
      mockSend.mockResolvedValue({
        output: {
          message: {
            content: [{ text: 'Just text, no tool call' }],
          },
        },
      })

      const provider = createBedrockProvider({
        models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
        resilience: { retry: false },
      })
      try {
        await provider.sendRequest(makeRequest())
        fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(A3ResilienceError)
        expect((err as A3ResilienceError).errors[0].error.message).toMatch('invalid tool response')
      }
    })

    it('should throw on empty content blocks', async () => {
      mockSend.mockResolvedValue({
        output: { message: { content: [] } },
      })

      const provider = createBedrockProvider({
        models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
        resilience: { retry: false },
      })
      try {
        await provider.sendRequest(makeRequest())
        fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(A3ResilienceError)
        expect((err as A3ResilienceError).errors[0].error.message).toMatch('invalid tool response')
      }
    })

    it('should prepend RESPONSE_FORMAT_INSTRUCTIONS to the system prompt', async () => {
      const toolResponse = {
        chatbotMessage: 'Hi',
        conversationPayload: {},
        redirectToAgent: null,
      }
      mockSend.mockResolvedValue({
        output: { message: { content: [{ toolUse: { input: toolResponse } }] } },
        usage: { inputTokens: 10, outputTokens: 10 },
      })

      const provider = createBedrockProvider({ models: ['model-1'] })
      await provider.sendRequest(makeRequest({ systemPrompt: 'Be helpful.' }))

      const callArgs = getMockSendInput(0)
      expect(callArgs.system[0].text).toContain('RESPONSE FORMAT')
      expect(callArgs.system[0].text).toContain('Be helpful.')
    })

    it('should prepend "Hi" message and merge sequential same-role messages', async () => {
      const toolResponse = {
        chatbotMessage: 'Response',
        conversationPayload: {},
        redirectToAgent: null,
      }
      mockSend.mockResolvedValue({
        output: { message: { content: [{ toolUse: { input: toolResponse } }] } },
        usage: { inputTokens: 10, outputTokens: 10 },
      })

      const provider = createBedrockProvider({ models: ['model-1'] })
      await provider.sendRequest(
        makeRequest({
          messages: [
            { role: 'user', content: 'First message' },
            { role: 'user', content: 'Second message' },
          ],
        }),
      )

      const callArgs = getMockSendInput(0)
      // "Hi" + two user messages should be merged into a single user message
      expect(callArgs.messages).toHaveLength(1)
      expect(callArgs.messages[0].role).toBe('user')
      expect(callArgs.messages[0].content).toHaveLength(3) // "Hi", "First message", "Second message"
    })

    it('should include tool config with structuredResponse tool', async () => {
      const toolResponse = {
        chatbotMessage: 'Hi',
        conversationPayload: {},
        redirectToAgent: null,
      }
      mockSend.mockResolvedValue({
        output: { message: { content: [{ toolUse: { input: toolResponse } }] } },
        usage: { inputTokens: 10, outputTokens: 10 },
      })

      const provider = createBedrockProvider({ models: ['model-1'] })
      await provider.sendRequest(makeRequest())

      const callArgs = getMockSendInput(0)
      expect(callArgs.toolConfig.tools[0].toolSpec.name).toBe('structuredResponse')
      expect(callArgs.toolConfig.toolChoice).toEqual({ any: {} })
    })
  })

  describe('model fallback', () => {
    it('should fall back to the next model on failure', async () => {
      const toolResponse = {
        chatbotMessage: 'Fallback response',
        conversationPayload: {},
        redirectToAgent: null,
      }

      mockSend.mockRejectedValueOnce(new Error('Throttling')).mockResolvedValueOnce({
        output: { message: { content: [{ toolUse: { input: toolResponse } }] } },
        usage: { inputTokens: 10, outputTokens: 10 },
      })

      const provider = createBedrockProvider({
        models: ['model-primary', 'model-fallback'],
        resilience: { retry: false },
      })
      const result = await provider.sendRequest(makeRequest())

      const parsed = JSON.parse(result.content) as Record<string, unknown>
      expect(parsed.chatbotMessage).toBe('Fallback response')
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should throw A3ResilienceError when all models fail', async () => {
      mockSend.mockRejectedValueOnce(new Error('Error 1')).mockRejectedValueOnce(new Error('Error 2'))

      const provider = createBedrockProvider({
        models: ['model-1', 'model-2'],
        resilience: { retry: false },
      })
      await expect(provider.sendRequest(makeRequest())).rejects.toThrow('All models failed')
    })
  })

  describe('sendRequestStream', () => {
    it('should yield TEXT_MESSAGE_CONTENT for text deltas and TOOL_CALL_RESULT for tool response', async () => {
      const toolInput = JSON.stringify({
        chatbotMessage: 'Hello!',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      })

      mockSend.mockResolvedValue({
        stream: (async function* () {
          await Promise.resolve()
          // Text block
          yield { contentBlockStart: { start: {} } }
          yield { contentBlockDelta: { delta: { text: 'Hello!' } } }
          yield { contentBlockStop: {} }
          // Tool use block
          yield { contentBlockStart: { start: { toolUse: { name: 'structuredResponse', toolUseId: 'tool-1' } } } }
          yield { contentBlockDelta: { delta: { toolUse: { input: toolInput } } } }
          yield { contentBlockStop: {} }
          yield { metadata: { usage: { inputTokens: 10, outputTokens: 20 } } }
        })(),
      })

      const provider = createBedrockProvider({ models: ['model-1'] })
      const events = []
      for await (const event of provider.sendRequestStream(makeRequest())) {
        events.push(event)
      }

      const textEvents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      expect(textEvents).toHaveLength(1)
      expect((textEvents[0] as { delta: string }).delta).toBe('Hello!')

      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)
      expect(toolResult).toBeDefined()
      const content = JSON.parse((toolResult as { content: string }).content) as Record<string, unknown>
      expect(content.chatbotMessage).toBe('Hello!')
    })

    it('should use auto tool choice for streaming', async () => {
      mockSend.mockResolvedValue({
        stream: (async function* () {
          await Promise.resolve()
          yield { metadata: {} }
        })(),
      })

      const provider = createBedrockProvider({ models: ['model-1'] })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of provider.sendRequestStream(makeRequest())) {
        // consume
      }

      const callArgs = getMockSendInput(0)
      expect(callArgs.toolConfig.toolChoice).toEqual({ auto: {} })
    })

    it('should throw when no stream is returned', async () => {
      mockSend.mockResolvedValue({ stream: null })

      const provider = createBedrockProvider({ models: ['model-1'], resilience: { retry: false } })
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of provider.sendRequestStream(makeRequest())) {
          // consume
        }
        fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(A3ResilienceError)
        expect((err as A3ResilienceError).errors[0].error.message).toMatch('No stream returned from Bedrock')
      }
    })
  })
})
