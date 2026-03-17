import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, streamText, Output, ModelMessage } from 'ai'
import {
  resolveResilienceConfig,
  type Provider,
  type ProviderRequest,
  type ProviderResponse,
  type ProviderMessage,
  type BaseState,
  type StreamEvent,
  type ResilienceConfig,
  type ResolvedResilienceConfig,
} from '@genui-a3/core'
import { processAnthropicStream } from './streamProcessor'
import { executeWithFallback } from '@providers/utils/executeWithFallback'

/**
 * Configuration for creating an Anthropic provider.
 */
export interface AnthropicProviderConfig {
  /** Anthropic API key. Defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string
  /**
   * Model identifiers in order of preference (first = primary, rest = fallbacks).
   * e.g. ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001']
   */
  models: string[]
  /** Optional custom base URL for the Anthropic API */
  baseURL?: string
  /** Resilience configuration (retry, backoff, timeout). Uses industry-standard defaults if omitted. */
  resilience?: ResilienceConfig
}

function toAIMessages(messages: ProviderMessage[]): ModelMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))
}

export function prepareMessages(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length === 0) return messages
  const lastMessage = messages[messages.length - 1]
  if (lastMessage.role === 'assistant') {
    return [...messages, { role: 'user', content: 'Continue' }]
  }
  return messages
}

async function sendWithModel(
  anthropicProvider: ReturnType<typeof createAnthropic>,
  model: string,
  system: string,
  messages: ModelMessage[],
  schema: ProviderRequest['responseSchema'],
): Promise<ProviderResponse> {
  const preparedMessages = prepareMessages(messages)
  const result = await generateText({
    model: anthropicProvider(model),
    system,
    messages: preparedMessages,
    output: Output.object({ schema }),
  })

  return {
    content: JSON.stringify(result.output),
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
    },
  }
}

async function sendStreamWithModel(
  anthropicProvider: ReturnType<typeof createAnthropic>,
  model: string,
  system: string,
  messages: ModelMessage[],
  schema: ProviderRequest['responseSchema'],
) {
  const preparedMessages = prepareMessages(messages)
  const result = streamText({
    model: anthropicProvider(model),
    system,
    messages: preparedMessages,
    output: Output.object({ schema }),
  })

  // Force the API call to start so executeWithFallback can catch connection errors
  const partialStream = result.partialOutputStream
  const reader = partialStream[Symbol.asyncIterator]()
  const first = await reader.next()

  return { result, reader, first }
}

/**
 * Creates an Anthropic provider instance.
 *
 * Uses the Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) for structured output via
 * `generateText` + `Output.object()` (blocking) and `streamText` + `Output.object()`
 * (streaming). The AI SDK handles Zod-to-JSON-schema conversion, partial JSON
 * parsing, and validation internally.
 *
 * @param config - Anthropic provider configuration
 * @returns A Provider implementation using Anthropic
 *
 * @example
 * ```typescript
 * const provider = createAnthropicProvider({
 *   models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
 * })
 * ```
 */
export function createAnthropicProvider(config: AnthropicProviderConfig): Provider {
  const anthropicProvider = createAnthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  })
  const models = config.models
  const resilience: ResolvedResilienceConfig = resolveResilienceConfig(config.resilience)

  return {
    name: 'anthropic',

    async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
      const messages = toAIMessages(request.messages)

      return executeWithFallback(
        models,
        (model) => sendWithModel(anthropicProvider, model, request.systemPrompt, messages, request.responseSchema),
        resilience,
      )
    },

    async *sendRequestStream<TState extends BaseState = BaseState>(
      request: ProviderRequest,
    ): AsyncGenerator<StreamEvent<TState>> {
      const messages = toAIMessages(request.messages)

      const { result, reader, first } = await executeWithFallback(
        models,
        (model) =>
          sendStreamWithModel(anthropicProvider, model, request.systemPrompt, messages, request.responseSchema),
        resilience,
      )

      yield* processAnthropicStream<TState>(result, reader, first, 'anthropic', request.responseSchema)
    },
  }
}
