import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  ConverseStreamOutput,
  ToolInputSchema,
} from '@aws-sdk/client-bedrock-runtime'
import { ZodType } from 'zod'
import { Agent, BaseState, BaseChatContext, Conversation, MessageSender } from 'types'
import { Events } from 'types/events'
import { logEvent } from '@utils/eventLogger'
import { mergeSequentialMessages } from '@utils/messageMerger'
import { log } from '@utils/logger'

const bedrockAgentClient = new BedrockRuntimeClient()

const RESPONSE_FORMAT_INSTRUCTIONS = `

# RESPONSE FORMAT — MANDATORY

<<CRITICAL INSTRUCTION>>
You MUST ALWAYS output plain text FIRST, then call the structuredResponse tool SECOND. NEVER call the tool without writing text first. This is non-negotiable.
<</CRITICAL INSTRUCTION>>

Your response MUST have exactly two parts in this order:

PART 1 — TEXT: Write your full conversational reply as plain text. This text is streamed to the user in real-time. Do not skip this.

PART 2 — TOOL CALL: After the text, call the \`structuredResponse\` tool with the JSON payload. The \`chatbotMessage\` field MUST contain the same text you wrote in Part 1.

If you call the tool without writing text first, the response will be broken.`

type SendWithModelParams = {
  modelArn: string
  modelName: string
  systemPrompt: string
  mergedMessages: ReturnType<typeof mergeSequentialMessages>
  inputSchema: ToolInputSchema | undefined
}

function getCommandInput(params: SendWithModelParams, isStream: boolean) {
  return {
    modelId: params.modelArn,
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
      toolChoice: {
        auto: {},
      },
    },
  }
}

export async function sendWithModel(params: SendWithModelParams): Promise<string> {
  const command = new ConverseCommand(getCommandInput(params, false))
  const response = await bedrockAgentClient.send(command)

  // With auto toolChoice, content[] may have text blocks before the toolUse block.
  // Find the toolUse block in the content array.
  const contentBlocks = response.output?.message?.content ?? []
  const toolUseBlock = contentBlocks.find((block) => block.toolUse)
  const result = toolUseBlock?.toolUse?.input

  // Validate that we received a valid tool response - throw to trigger retry/fallback
  const isValidResponse =
    result &&
    typeof result === 'object' &&
    'conversationPayload' in result &&
    'chatbotMessage' in result &&
    typeof result.conversationPayload === 'object' &&
    typeof result.chatbotMessage === 'string'

  if (!isValidResponse) {
    log.warn('Bedrock returned invalid tool response', {
      modelArn: params.modelArn,
      modelName: params.modelName,
      result,
    })
    throw new Error('Bedrock returned invalid tool response')
  }

  void logEvent(Events.AgentResponse, {
    modelId: params.modelArn,
    modelName: params.modelName,
    usage: response.usage,
    metrics: response.metrics,
  })

  return JSON.stringify(result)
}

export async function sendStreamWithModel(params: SendWithModelParams): Promise<AsyncIterable<ConverseStreamOutput>> {
  const command = new ConverseStreamCommand(getCommandInput(params, true))

  log.debug(`Streaming request with ${params.modelName}`)
  const response = await bedrockAgentClient.send(command)

  if (!response.stream) {
    throw new Error('No stream returned from Bedrock')
  }

  return response.stream
}

export type SendChatRequestParams<TState extends BaseState, TContext extends BaseChatContext = BaseChatContext> = {
  agent: Agent<TState, TContext>
  systemPrompt: string
  basePrompt: string
  conversation: Conversation
  responseFormat: ZodType
}

const DEFAULT_MODELS = [
  { arn: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5' },
  { arn: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5' },
]

function prepareChatParams<TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>(
  params: SendChatRequestParams<TState, TContext>,
) {
  const { agent, systemPrompt: rawSystemPrompt, basePrompt, conversation, responseFormat } = params

  const systemPrompt = RESPONSE_FORMAT_INSTRUCTIONS + '\n\n' + rawSystemPrompt + basePrompt

  // Convert the Zod schema to JSON schema for the AWS Bedrock runtime
  const jsonSchema = responseFormat.toJSONSchema()

  const filteredConversation = agent.filterHistoryStrategy ? agent.filterHistoryStrategy(conversation) : conversation
  const inputSchema = { json: jsonSchema } as ToolInputSchema
  const prependedConversation = [{ text: 'Hi', metadata: { source: MessageSender.USER } }, ...filteredConversation]
  const mergedMessages = mergeSequentialMessages(prependedConversation)

  return { systemPrompt, inputSchema, mergedMessages }
}

async function executeWithFallback<T>(
  action: (model: { arn: string; name: string }, attemptCount: number) => Promise<T>,
  actionName: string,
): Promise<T> {
  const errors: Array<{ model: string; error: Error }> = []
  let attemptCount = 0

  for (const model of DEFAULT_MODELS) {
    const isLastModel = attemptCount === DEFAULT_MODELS.length - 1

    try {
      log.debug(`Attempting ${actionName} with ${model.name} model${attemptCount > 0 ? ' (fallback)' : ''}`)
      // eslint-disable-next-line no-await-in-loop
      return await action(model, attemptCount)
    } catch (error) {
      const errorObj = error as Error
      errors.push({ model: model.name, error: errorObj })

      log.warn(`${model.name} ${actionName} failed:`, errorObj)
      void logEvent(Events.AgentError, {
        modelId: model.arn,
        modelName: model.name,
        error: errorObj.message,
        fallback: !isLastModel,
      })

      if (isLastModel) {
        log.error(`All models failed (${actionName}):`, errors)
        throw errorObj
      }

      attemptCount++
    }
  }

  throw new Error('All models failed')
}

export const sendChatRequest = async <TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>(
  params: SendChatRequestParams<TState, TContext>,
) => {
  const { systemPrompt, inputSchema, mergedMessages } = prepareChatParams(params)

  return executeWithFallback(
    (model) =>
      sendWithModel({
        modelArn: model.arn,
        modelName: model.name,
        systemPrompt,
        mergedMessages,
        inputSchema,
      }),
    'request',
  )
}

export const sendChatRequestStream = async <
  TState extends BaseState,
  TContext extends BaseChatContext = BaseChatContext,
>(
  params: SendChatRequestParams<TState, TContext>,
) => {
  const { systemPrompt, inputSchema, mergedMessages } = prepareChatParams(params)

  return executeWithFallback(
    (model) =>
      sendStreamWithModel({
        modelArn: model.arn,
        modelName: model.name,
        systemPrompt,
        mergedMessages,
        inputSchema,
      }),
    'stream request',
  )
}
