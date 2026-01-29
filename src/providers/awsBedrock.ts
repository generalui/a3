import { BedrockRuntimeClient, ConverseCommand, ToolInputSchema } from '@aws-sdk/client-bedrock-runtime'
import { ZodType } from 'zod'
import { Agent, BaseState, Conversation, MessageSender } from 'types'
import { Events } from 'types/events'
import { logEvent } from '@utils/eventLogger'
import { mergeSequentialMessages } from '@utils/messageMerger'
import { log } from '@utils/logger'

const bedrockAgentClient = new BedrockRuntimeClient()

type SendWithModelParams = {
  modelArn: string
  modelName: string
  systemPrompt: string
  mergedMessages: ReturnType<typeof mergeSequentialMessages>
  inputSchema: ToolInputSchema | undefined
}

export async function sendWithModel({
  modelArn,
  modelName,
  systemPrompt,
  mergedMessages,
  inputSchema,
}: SendWithModelParams): Promise<string> {
  const command = new ConverseCommand({
    modelId: modelArn,
    system: [{ text: systemPrompt }],
    messages: mergedMessages,
    toolConfig: {
      tools: [
        {
          toolSpec: {
            name: 'structuredResponse',
            description: 'A tool to generate a structured response',
            inputSchema,
          },
        },
      ],
      toolChoice: {
        tool: {
          name: 'structuredResponse',
        },
      },
    },
  })

  const response = await bedrockAgentClient.send(command)
  const result = response.output?.message?.content?.[0]?.toolUse?.input

  // Validate that we received a valid tool response - throw to trigger retry/fallback
  const isValidResponse =
    result &&
    typeof result === 'object' &&
    'conversationPayload' in result &&
    'chatbotMessage' in result &&
    typeof result.conversationPayload === 'object' &&
    typeof result.chatbotMessage === 'string'

  if (!isValidResponse) {
    log.warn('Bedrock returned invalid tool response', { modelArn, modelName, result })
    throw new Error('Bedrock returned invalid tool response')
  }

  void logEvent(Events.AgentResponse, {
    modelId: modelArn,
    modelName,
    usage: response.usage,
    metrics: response.metrics,
  })

  return JSON.stringify(result)
}

type SendChatRequestParams<TState extends BaseState> = {
  agent: Agent<TState>
  systemPrompt: string
  basePrompt: string
  conversation: Conversation
  responseFormat: ZodType
}

export const sendChatRequest = async <TState extends BaseState>({
  agent,
  systemPrompt,
  basePrompt,
  conversation,
  responseFormat,
}: SendChatRequestParams<TState>) => {
  systemPrompt = systemPrompt + basePrompt

  // Convert the Zod schema to JSON schema for the AWS Bedrock runtime
  const jsonSchema = responseFormat.toJSONSchema()

  const filteredConversation = agent.filterHistoryStrategy ? agent.filterHistoryStrategy(conversation) : conversation
  const inputSchema = { json: jsonSchema } as ToolInputSchema
  const prependedConversation = [{ text: 'Hi', metadata: { source: MessageSender.USER } }, ...filteredConversation]
  const mergedMessages = mergeSequentialMessages(prependedConversation)

  const models = [{ arn: 'us.amazon.nova-2-lite-v1:0', name: 'Nova Lite 2' }]

  // Try each model in order until one succeeds
  const errors: Array<{ model: string; error: Error }> = []
  let attemptCount = 0

  for (const model of models) {
    const { arn, name } = model
    const isLastModel = attemptCount === models.length - 1

    try {
      log.debug(`Attempting request with ${name} model${attemptCount > 0 ? ' (fallback)' : ''}`)
      // eslint-disable-next-line no-await-in-loop
      return await sendWithModel({
        modelArn: arn,
        modelName: name,
        systemPrompt,
        mergedMessages,
        inputSchema,
      })
    } catch (error) {
      const errorObj = error as Error
      errors.push({ model: name, error: errorObj })

      log.warn(`${name} model failed:`, errorObj)
      void logEvent(Events.AgentError, {
        modelId: arn,
        modelName: name,
        error: errorObj.message,
        fallback: !isLastModel,
      })

      if (isLastModel) {
        log.error('All models failed:', errors)
        throw errorObj
      }

      attemptCount++
    }
  }

  throw new Error('All models failed')
}
