import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  ConverseStreamOutput,
  ToolInputSchema,
} from '@aws-sdk/client-bedrock-runtime'
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
import { mergeSequentialMessages } from '@providers-bedrock/messageMerger'
import { processBedrockStream } from '@providers-bedrock/streamProcessor'
import { executeWithFallback } from '@providers-utils/executeWithFallback'

const RESPONSE_FORMAT_INSTRUCTIONS = `

# RESPONSE FORMAT — MANDATORY

<<CRITICAL INSTRUCTION>>
You MUST ALWAYS output plain text FIRST, then call the structuredResponse tool SECOND. NEVER call the tool without writing text first. This is non-negotiable.
<</CRITICAL INSTRUCTION>>

Your response MUST have exactly two parts in this order:

PART 1 — TEXT: Write your full conversational reply as plain text. This text is streamed to the user in real-time. Do not skip this.

PART 2 — TOOL CALL: After the text, call the \`structuredResponse\` tool with the JSON payload. The \`chatbotMessage\` field MUST contain the same text you wrote in Part 1.

If you call the tool without writing text first, the response will be broken.`

/**
 * Configuration for creating a Bedrock provider.
 */
export interface BedrockProviderConfig {
  /** AWS region for the Bedrock client */
  region?: string
  /**
   * Model identifiers in order of preference (first = primary, rest = fallbacks).
   * Uses Bedrock model ARNs, e.g. 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
   */
  models: string[]
  /** Resilience configuration (retry, backoff, timeout). Uses industry-standard defaults if omitted. */
  resilience?: ResilienceConfig
}

type SendWithModelParams = {
  modelId: string
  systemPrompt: string
  mergedMessages: ReturnType<typeof mergeSequentialMessages>
  inputSchema: ToolInputSchema | undefined
}

function getCommandInput(params: SendWithModelParams, isStream: boolean) {
  return {
    modelId: params.modelId,
    system: [{ text: params.systemPrompt }],
    messages: params.mergedMessages,
    toolConfig: {
      tools: [
        {
          toolSpec: {
            name: 'structuredResponse',
            description: isStream
              ? 'Submit your structured response data. IMPORTANT: You MUST write your full text reply BEFORE calling this tool. Never call this tool as your first action.'
              : 'A tool to generate a structured response',
            inputSchema: params.inputSchema,
          },
        },
      ],
      toolChoice: isStream ? { auto: {} } : { any: {} },
    },
  }
}

async function sendWithModel(client: BedrockRuntimeClient, params: SendWithModelParams): Promise<ProviderResponse> {
  const command = new ConverseCommand(getCommandInput(params, false))
  const response = await client.send(command)

  const contentBlocks = response.output?.message?.content ?? []
  const toolUseBlock = contentBlocks.find((block) => block.toolUse)
  const result = toolUseBlock?.toolUse?.input

  const isValidResponse =
    result &&
    typeof result === 'object' &&
    'conversationPayload' in result &&
    'chatbotMessage' in result &&
    typeof result.conversationPayload === 'object' &&
    typeof result.chatbotMessage === 'string'

  if (!isValidResponse) {
    throw new Error('Bedrock returned invalid tool response')
  }

  return {
    content: JSON.stringify(result),
    usage: response.usage
      ? {
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          totalTokens: (response.usage.inputTokens ?? 0) + (response.usage.outputTokens ?? 0),
        }
      : undefined,
  }
}

async function sendStreamWithModel(
  client: BedrockRuntimeClient,
  params: SendWithModelParams,
): Promise<AsyncIterable<ConverseStreamOutput>> {
  const command = new ConverseStreamCommand(getCommandInput(params, true))
  const response = await client.send(command)

  if (!response.stream) {
    throw new Error('No stream returned from Bedrock')
  }

  return response.stream
}

function prepareRequest(request: ProviderRequest) {
  const systemPrompt = RESPONSE_FORMAT_INSTRUCTIONS + '\n\n' + request.systemPrompt
  const jsonSchema = request.responseSchema.toJSONSchema()
  const inputSchema = { json: jsonSchema } as ToolInputSchema

  // Bedrock requires messages to start with a user message — prepend "Hi" if needed
  const prependedMessages: ProviderMessage[] = [{ role: 'user', content: 'Hi\n' }, ...request.messages]
  const mergedMessages = mergeSequentialMessages(prependedMessages)

  return { systemPrompt, inputSchema, mergedMessages }
}

/**
 * Creates an AWS Bedrock provider instance.
 *
 * @param config - Bedrock provider configuration
 * @returns A Provider implementation using AWS Bedrock
 *
 * @example
 * ```typescript
 * const provider = createBedrockProvider({
 *   models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
 *   region: 'us-east-1',
 * })
 * ```
 */
export function createBedrockProvider(config: BedrockProviderConfig): Provider {
  const client = new BedrockRuntimeClient(config.region ? { region: config.region } : {})
  const models = config.models
  const resilience: ResolvedResilienceConfig = resolveResilienceConfig(config.resilience)

  return {
    name: 'bedrock',

    async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
      const { systemPrompt, inputSchema, mergedMessages } = prepareRequest(request)

      return executeWithFallback(
        models,
        (modelId) =>
          sendWithModel(client, {
            modelId,
            systemPrompt,
            mergedMessages,
            inputSchema,
          }),
        resilience,
      )
    },

    async *sendRequestStream<TState extends BaseState = BaseState>(
      request: ProviderRequest,
    ): AsyncGenerator<StreamEvent<TState>> {
      const { systemPrompt, inputSchema, mergedMessages } = prepareRequest(request)

      const rawStream = await executeWithFallback(
        models,
        (modelId) =>
          sendStreamWithModel(client, {
            modelId,
            systemPrompt,
            mergedMessages,
            inputSchema,
          }),
        resilience,
      )

      yield* processBedrockStream<TState>(rawStream, 'bedrock', request.responseSchema)
    },
  }
}
