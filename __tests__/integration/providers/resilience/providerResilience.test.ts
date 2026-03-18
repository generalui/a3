import { z } from 'zod'
import { createBedrockProvider } from '@providers-bedrock/index'
import { createOpenAIProvider } from '@providers-openai/index'
import { createAnthropicProvider } from '@providers-anthropic/index'
import { A3ResilienceError } from '@errors/resilience'
import type { ProviderRequest } from 'types/provider'

// ---------------------------------------------------------------------------
// Mock AWS Bedrock SDK
// ---------------------------------------------------------------------------

const mockBedrockSend = jest.fn()
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: mockBedrockSend,
  })),
  ConverseCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
  ConverseStreamCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}))

// ---------------------------------------------------------------------------
// Mock Vercel AI SDK (for OpenAI + Anthropic providers)
// ---------------------------------------------------------------------------

const mockGenerateText = jest.fn()
jest.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args) as unknown,
  streamText: jest.fn(),
  Output: { object: jest.fn() },
  jsonSchema: jest.fn((schema: unknown) => schema),
}))

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn().mockReturnValue(jest.fn((model: string) => model)),
}))

jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: jest.fn().mockReturnValue(jest.fn((model: string) => model)),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeBedrockToolResponse(message = 'Hello!') {
  return {
    output: {
      message: {
        content: [
          {
            toolUse: {
              input: {
                chatbotMessage: message,
                goalAchieved: false,
                conversationPayload: { userName: 'Alice' },
                redirectToAgent: null,
              },
            },
          },
        ],
      },
    },
    usage: { inputTokens: 100, outputTokens: 50 },
  }
}

function makeOpenAIResponse(message = 'Hello!') {
  return {
    output: {
      chatbotMessage: message,
      goalAchieved: false,
      conversationPayload: { userName: 'Alice' },
      redirectToAgent: null,
    },
    usage: { inputTokens: 100, outputTokens: 50 },
  }
}

// ---------------------------------------------------------------------------
// Bedrock provider resilience tests
// ---------------------------------------------------------------------------

describe('Bedrock provider — resilience integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should retry on AWS ThrottlingException and succeed', async () => {
    const throttleError = Object.assign(new Error('Rate exceeded'), {
      name: 'ThrottlingException',
      $metadata: { httpStatusCode: 429 },
    })

    mockBedrockSend.mockRejectedValueOnce(throttleError).mockResolvedValueOnce(makeBedrockToolResponse())

    const provider = createBedrockProvider({
      models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
      resilience: {
        retry: { maxAttempts: 2 },
        backoff: { strategy: 'fixed', baseDelayMs: 1, jitter: false },
      },
    })

    const result = await provider.sendRequest(makeRequest())
    const parsed = JSON.parse(result.content) as Record<string, unknown>

    expect(parsed.chatbotMessage).toBe('Hello!')
    expect(mockBedrockSend).toHaveBeenCalledTimes(2)
  })

  it('should fall back to secondary model on AWS 503', async () => {
    const serviceError = Object.assign(new Error('Service unavailable'), {
      name: 'ServiceUnavailableException',
      $metadata: { httpStatusCode: 503 },
    })

    // Primary: fail all retries (1 initial + 1 retry = 2 attempts)
    mockBedrockSend
      .mockRejectedValueOnce(serviceError)
      .mockRejectedValueOnce(serviceError)
      // Fallback: succeed
      .mockResolvedValueOnce(makeBedrockToolResponse('Fallback response'))

    const provider = createBedrockProvider({
      models: ['model-primary', 'model-fallback'],
      resilience: {
        retry: { maxAttempts: 1 },
        backoff: { strategy: 'fixed', baseDelayMs: 1, jitter: false },
      },
    })

    const result = await provider.sendRequest(makeRequest())
    const parsed = JSON.parse(result.content) as Record<string, unknown>

    expect(parsed.chatbotMessage).toBe('Fallback response')
    expect(mockBedrockSend).toHaveBeenCalledTimes(3)
  })

  it('should not retry AWS AccessDeniedException (403)', async () => {
    const accessError = Object.assign(new Error('Access denied'), {
      name: 'AccessDeniedException',
      $metadata: { httpStatusCode: 403 },
    })

    mockBedrockSend.mockRejectedValue(accessError)

    const provider = createBedrockProvider({
      models: ['model-1', 'model-2'],
      resilience: {
        retry: { maxAttempts: 3 },
        backoff: { strategy: 'fixed', baseDelayMs: 1, jitter: false },
      },
    })

    await expect(provider.sendRequest(makeRequest())).rejects.toThrow(A3ResilienceError)
    // 1 attempt per model, no retries for 403
    expect(mockBedrockSend).toHaveBeenCalledTimes(2)
  })

  it('should throw A3ResilienceError when all models and retries are exhausted', async () => {
    const serviceError = Object.assign(new Error('Service unavailable'), {
      name: 'ServiceUnavailableException',
      $metadata: { httpStatusCode: 503 },
    })

    mockBedrockSend.mockRejectedValue(serviceError)

    const provider = createBedrockProvider({
      models: ['model-1', 'model-2'],
      resilience: {
        retry: { maxAttempts: 1 },
        backoff: { strategy: 'fixed', baseDelayMs: 1, jitter: false },
      },
    })

    try {
      await provider.sendRequest(makeRequest())
      fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(A3ResilienceError)
      const resErr = err as A3ResilienceError
      // model-1: 2 attempts, model-2: 2 attempts
      expect(resErr.errors).toHaveLength(4)
      expect(resErr.errors[0].model).toBe('model-1')
      expect(resErr.errors[2].model).toBe('model-2')
    }
  })
})

// ---------------------------------------------------------------------------
// OpenAI provider resilience tests
// ---------------------------------------------------------------------------

describe('OpenAI provider — resilience integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should retry on Vercel AI SDK 429 error and succeed', async () => {
    const rateLimitError = Object.assign(new Error('rate_limit_exceeded'), { status: 429 })

    mockGenerateText.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce(makeOpenAIResponse())

    const provider = createOpenAIProvider({
      models: ['gpt-4o'],
      apiKey: 'test-key',
      resilience: {
        retry: { maxAttempts: 2 },
        backoff: { strategy: 'fixed', baseDelayMs: 1, jitter: false },
      },
    })

    const result = await provider.sendRequest(makeRequest())
    const parsed = JSON.parse(result.content) as Record<string, unknown>

    expect(parsed.chatbotMessage).toBe('Hello!')
    expect(mockGenerateText).toHaveBeenCalledTimes(2)
  })

  it('should fall back to secondary model on 500 error', async () => {
    const serverError = Object.assign(new Error('internal_server_error'), { status: 500 })

    // Primary: fail all retries
    mockGenerateText
      .mockRejectedValueOnce(serverError)
      .mockRejectedValueOnce(serverError)
      // Fallback: succeed
      .mockResolvedValueOnce(makeOpenAIResponse('Fallback'))

    const provider = createOpenAIProvider({
      models: ['gpt-4o', 'gpt-4o-mini'],
      apiKey: 'test-key',
      resilience: {
        retry: { maxAttempts: 1 },
        backoff: { strategy: 'fixed', baseDelayMs: 1, jitter: false },
      },
    })

    const result = await provider.sendRequest(makeRequest())
    const parsed = JSON.parse(result.content) as Record<string, unknown>

    expect(parsed.chatbotMessage).toBe('Fallback')
    expect(mockGenerateText).toHaveBeenCalledTimes(3)
  })

  it('should not retry 401 authentication errors', async () => {
    const authError = Object.assign(new Error('invalid_api_key'), { status: 401 })

    mockGenerateText.mockRejectedValue(authError)

    const provider = createOpenAIProvider({
      models: ['gpt-4o'],
      apiKey: 'bad-key',
      resilience: {
        retry: { maxAttempts: 3 },
        backoff: { strategy: 'fixed', baseDelayMs: 1, jitter: false },
      },
    })

    await expect(provider.sendRequest(makeRequest())).rejects.toThrow(A3ResilienceError)
    expect(mockGenerateText).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Anthropic provider resilience tests
// ---------------------------------------------------------------------------

describe('Anthropic provider — resilience integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should retry on 529 overloaded error and succeed', async () => {
    const overloadedError = Object.assign(new Error('overloaded'), { status: 529 })

    mockGenerateText.mockRejectedValueOnce(overloadedError).mockResolvedValueOnce(makeOpenAIResponse())

    const provider = createAnthropicProvider({
      models: ['claude-sonnet-4-5-20250929'],
      apiKey: 'test-key',
      resilience: {
        retry: { maxAttempts: 2 },
        backoff: { strategy: 'fixed', baseDelayMs: 1, jitter: false },
      },
    })

    const result = await provider.sendRequest(makeRequest())
    const parsed = JSON.parse(result.content) as Record<string, unknown>

    expect(parsed.chatbotMessage).toBe('Hello!')
    expect(mockGenerateText).toHaveBeenCalledTimes(2)
  })

  it('should fall back to haiku when sonnet is overloaded', async () => {
    const overloadedError = Object.assign(new Error('overloaded'), { status: 529 })

    // Sonnet: fail all retries
    mockGenerateText
      .mockRejectedValueOnce(overloadedError)
      .mockRejectedValueOnce(overloadedError)
      // Haiku: succeed
      .mockResolvedValueOnce(makeOpenAIResponse('Haiku response'))

    const provider = createAnthropicProvider({
      models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
      apiKey: 'test-key',
      resilience: {
        retry: { maxAttempts: 1 },
        backoff: { strategy: 'fixed', baseDelayMs: 1, jitter: false },
      },
    })

    const result = await provider.sendRequest(makeRequest())
    const parsed = JSON.parse(result.content) as Record<string, unknown>

    expect(parsed.chatbotMessage).toBe('Haiku response')
    expect(mockGenerateText).toHaveBeenCalledTimes(3)
  })

  it('should respect resilience: { retry: false } — no retries, just fallback', async () => {
    const error = Object.assign(new Error('overloaded'), { status: 529 })

    mockGenerateText.mockRejectedValueOnce(error).mockResolvedValueOnce(makeOpenAIResponse('Fallback'))

    const provider = createAnthropicProvider({
      models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
      apiKey: 'test-key',
      resilience: { retry: false },
    })

    const result = await provider.sendRequest(makeRequest())
    const parsed = JSON.parse(result.content) as Record<string, unknown>

    expect(parsed.chatbotMessage).toBe('Fallback')
    // 1 attempt on sonnet (no retries), 1 on haiku
    expect(mockGenerateText).toHaveBeenCalledTimes(2)
  })
})
