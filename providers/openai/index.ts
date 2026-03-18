import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText, Output, ModelMessage, jsonSchema } from 'ai'
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
} from '@genui-a3/a3'
import { processOpenAIStream } from '@providers-openai/streamProcessor'
import { executeWithFallback } from '@providers-utils/executeWithFallback'

/**
 * Configuration for creating an OpenAI provider.
 */
export interface OpenAIProviderConfig {
  /** OpenAI API key. Defaults to OPENAI_API_KEY env var (OpenAI SDK default). */
  apiKey?: string
  /**
   * Model identifiers in order of preference (first = primary, rest = fallbacks).
   * e.g. ['gpt-4o', 'gpt-4o-mini']
   */
  models: string[]
  /** Optional base URL for Azure OpenAI or compatible endpoints */
  baseURL?: string
  /** Optional OpenAI organization ID */
  organization?: string
  /** Resilience configuration (retry, backoff, timeout). Uses industry-standard defaults if omitted. */
  resilience?: ResilienceConfig
}

type JsonSchema = Record<string, unknown>

/**
 * Enforces strict JSON schema constraints required by OpenAI's structured output API.
 * OpenAI requires all object properties — including optional ones — to be in the `required` array.
 * This function recursively adds `required` and `additionalProperties: false` to all objects.
 *
 * @param schema - JSON schema to enforce
 * @returns Enforced JSON schema
 */
function enforceStrictSchema(schema: JsonSchema): JsonSchema {
  const result = { ...schema }
  if (result.type === 'object' && result.properties) {
    result.additionalProperties = false
    result.required = Object.keys(result.properties as Record<string, unknown>)
    const props = result.properties as Record<string, JsonSchema>
    const strictProps: Record<string, JsonSchema> = {}
    for (const [key, value] of Object.entries(props)) {
      strictProps[key] = enforceStrictSchema(value)
    }
    result.properties = strictProps
  }
  if (result.items && typeof result.items === 'object') {
    result.items = enforceStrictSchema(result.items as JsonSchema)
  }
  for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(result[keyword])) {
      result[keyword] = (result[keyword] as JsonSchema[]).map((s) => enforceStrictSchema(s))
    }
  }
  return result
}

/**
 * Converts a Zod schema to an OpenAI-compatible strict JSON schema wrapped for the Vercel AI SDK.
 *
 * @param zodSchema - Zod schema to convert
 * @returns JSON schema wrapped for Vercel AI SDK
 */
function toOpenAISchema(zodSchema: ProviderRequest['responseSchema']) {
  const strict = enforceStrictSchema(zodSchema.toJSONSchema() as JsonSchema)
  return jsonSchema(strict as never, {
    validate: (value: unknown) => {
      const result = zodSchema.safeParse(value)
      return result.success
        ? { success: true as const, value: result.data }
        : { success: false as const, error: result.error }
    },
  })
}

function toAIMessages(messages: ProviderMessage[]): ModelMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))
}

async function sendWithModel(
  openaiProvider: ReturnType<typeof createOpenAI>,
  model: string,
  system: string,
  messages: ModelMessage[],
  schema: ProviderRequest['responseSchema'],
): Promise<ProviderResponse> {
  const result = await generateText({
    model: openaiProvider(model),
    system,
    messages,
    output: Output.object({ schema: toOpenAISchema(schema) }),
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
  openaiProvider: ReturnType<typeof createOpenAI>,
  model: string,
  system: string,
  messages: ModelMessage[],
  schema: ProviderRequest['responseSchema'],
) {
  const result = streamText({
    model: openaiProvider(model),
    system,
    messages,
    output: Output.object({ schema: toOpenAISchema(schema) }),
  })

  // Force the API call to start so executeWithFallback can catch connection errors
  const partialStream = result.partialOutputStream
  const reader = partialStream[Symbol.asyncIterator]()
  const first = await reader.next()

  return { result, reader, first }
}

/**
 * Creates an OpenAI provider instance.
 *
 * Uses the Vercel AI SDK (`ai` + `@ai-sdk/openai`) for structured output via
 * `generateText` + `Output.object()` (blocking) and `streamText` + `Output.object()`
 * (streaming). The AI SDK handles Zod-to-JSON-schema conversion, partial JSON
 * parsing, and validation internally.
 *
 * @param config - OpenAI provider configuration
 * @returns A Provider implementation using OpenAI
 *
 * @example
 * ```typescript
 * const provider = createOpenAIProvider({
 *   models: ['gpt-4o', 'gpt-4o-mini'],
 * })
 * ```
 */
export function createOpenAIProvider(config: OpenAIProviderConfig): Provider {
  const openaiProvider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    organization: config.organization,
  })
  const models = config.models
  const resilience: ResolvedResilienceConfig = resolveResilienceConfig(config.resilience)

  return {
    name: 'openai',

    async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
      const messages = toAIMessages(request.messages)

      return executeWithFallback(
        models,
        (model) => sendWithModel(openaiProvider, model, request.systemPrompt, messages, request.responseSchema),
        resilience,
      )
    },

    async *sendRequestStream<TState extends BaseState = BaseState>(
      request: ProviderRequest,
    ): AsyncGenerator<StreamEvent<TState>> {
      const messages = toAIMessages(request.messages)

      const { result, reader, first } = await executeWithFallback(
        models,
        (model) => sendStreamWithModel(openaiProvider, model, request.systemPrompt, messages, request.responseSchema),
        resilience,
      )

      yield* processOpenAIStream<TState>(result, reader, first, 'openai', request.responseSchema)
    },
  }
}
