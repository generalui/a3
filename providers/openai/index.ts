import OpenAI from 'openai'
import type {
  Provider,
  ProviderRequest,
  ProviderResponse,
  ProviderMessage,
  BaseState,
  StreamEvent,
} from '@genui-a3/core'
import { processOpenAIStream } from './streamProcessor'
import { executeWithFallback } from '../utils/executeWithFallback'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

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
}

type JsonSchema = Record<string, unknown>

/**
 * Recursively enforces OpenAI structured output requirements on a JSON Schema:
 * - Adds `additionalProperties: false` to all object types
 * - Ensures all properties are listed in `required`
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

  // Handle anyOf/oneOf/allOf
  for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(result[keyword])) {
      result[keyword] = (result[keyword] as JsonSchema[]).map((s) => enforceStrictSchema(s))
    }
  }

  return result
}

function toOpenAIMessages(
  systemPrompt: string,
  messages: ProviderMessage[],
): ChatCompletionMessageParam[] {
  const openAIMessages: ChatCompletionMessageParam[] = [{ role: 'system', content: systemPrompt }]

  for (const msg of messages) {
    openAIMessages.push({ role: msg.role, content: msg.content })
  }

  return openAIMessages
}

function prepareRequest(request: ProviderRequest) {
  const jsonSchema = enforceStrictSchema(request.responseSchema.toJSONSchema() as JsonSchema)
  const responseFormat = {
    type: 'json_schema' as const,
    json_schema: {
      name: 'structuredResponse',
      strict: true,
      schema: jsonSchema,
    },
  }
  const openAIMessages = toOpenAIMessages(request.systemPrompt, request.messages)

  return { responseFormat, openAIMessages }
}

async function sendWithModel(
  client: OpenAI,
  model: string,
  openAIMessages: ChatCompletionMessageParam[],
  responseFormat: {
    type: 'json_schema'
    json_schema: { name: string; strict: boolean; schema: JsonSchema }
  },
): Promise<ProviderResponse> {
  const response = await client.chat.completions.create({
    model,
    messages: openAIMessages,
    response_format: responseFormat,
  })

  const choice = response.choices[0]
  if (!choice?.message?.content) {
    throw new Error('OpenAI returned empty response')
  }

  if (choice.finish_reason === 'length') {
    throw new Error('OpenAI response truncated (finish_reason: length)')
  }

  return {
    content: choice.message.content,
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
  }
}

async function sendStreamWithModel(
  client: OpenAI,
  model: string,
  openAIMessages: ChatCompletionMessageParam[],
  responseFormat: {
    type: 'json_schema'
    json_schema: { name: string; strict: boolean; schema: JsonSchema }
  },
) {
  return client.chat.completions.create({
    model,
    messages: openAIMessages,
    response_format: responseFormat,
    stream: true,
  })
}

/**
 * Creates an OpenAI provider instance.
 *
 * Uses OpenAI's structured output (response_format with JSON Schema) for both
 * blocking and streaming paths, with real-time chatbotMessage text streaming
 * via a custom stream processor.
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
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    organization: config.organization,
  })
  const models = config.models

  return {
    name: 'openai',

    async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
      const { responseFormat, openAIMessages } = prepareRequest(request)

      return executeWithFallback(models, (model) =>
        sendWithModel(client, model, openAIMessages, responseFormat),
      )
    },

    async *sendRequestStream<TState extends BaseState = BaseState>(
      request: ProviderRequest,
    ): AsyncGenerator<StreamEvent<TState>> {
      const { responseFormat, openAIMessages } = prepareRequest(request)

      const rawStream = await executeWithFallback(models, (model) =>
        sendStreamWithModel(client, model, openAIMessages, responseFormat),
      )

      yield* processOpenAIStream<TState>(rawStream, 'openai', request.responseSchema)
    },
  }
}
