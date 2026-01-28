import { BedrockRuntimeClient, ConverseCommand, ToolInputSchema } from '@aws-sdk/client-bedrock-runtime'
import { CloudFormationClient, DescribeStacksCommand, Output } from '@aws-sdk/client-cloudformation'
import { ZodType, ZodTypeDef } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Agent, Conversation, MessageSender } from 'types'
import { Events } from 'types/events'
import { Environment, getEnvStage } from '@utils/environments'
import { logEvent } from '@utils/eventLogger'
import { mergeSequentialMessages } from '@utils/messageMerger'
import { log } from '@utils/logger'

export const BEDROCK_HAIKU_INFERENCE_PROFILE_ARN_KEY = 'BedrockHaikuInferenceProfileArn'
export const BEDROCK_SONNET_INFERENCE_PROFILE_ARN_KEY = 'BedrockSonnetInferenceProfileArn'

const bedrockAgentClient = new BedrockRuntimeClient()
const cloudFormationClient = new CloudFormationClient()

let cachedModels: Array<{ arn: string; name: string }> | undefined

async function fetchInferenceProfileArns(): Promise<Array<{ arn: string; name: string }>> {
  if (cachedModels) {
    return cachedModels
  }

  const currentStage = getEnvStage()
  // There is not inference profile ARN for the test stage, so we use the sandbox stage
  const stage = currentStage === Environment.Test ? Environment.Sandbox : currentStage
  const stackName = `care-agent-${stage}`

  try {
    const command = new DescribeStacksCommand({ StackName: stackName })
    const response = await cloudFormationClient.send(command)

    if (!response.Stacks?.[0]?.Outputs) {
      throw new Error('No exports found in CloudFormation response')
    }

    const outputs = response.Stacks[0].Outputs

    const haikuExport = outputs.find((output: Output) => output.OutputKey === BEDROCK_HAIKU_INFERENCE_PROFILE_ARN_KEY)
    const sonnetExport = outputs.find((output: Output) => output.OutputKey === BEDROCK_SONNET_INFERENCE_PROFILE_ARN_KEY)

    if (haikuExport?.OutputValue && sonnetExport?.OutputValue) {
      // Both Haiku and Sonnet available - use both with fallback
      // eslint-disable-next-line require-atomic-updates
      cachedModels = [
        { arn: haikuExport.OutputValue, name: 'haiku' },
        { arn: sonnetExport.OutputValue, name: 'sonnet' },
      ]
      log.debug(`Cached inference profile ARNs for stage ${stage}:`, {
        haiku: haikuExport.OutputValue,
        sonnet: sonnetExport.OutputValue,
      })
    } else {
      throw new Error('Could not find CloudFormation exports for inference profiles')
    }

    return cachedModels
  } catch (error) {
    // Handle AWS SDK errors - they may not always be Error instances
    // AWS SDK v3 errors can have different structures depending on the error type
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (error && typeof error === 'object') {
      // Check for AWS SDK error structure (may have name, message, $fault, $metadata properties)
      if ('message' in error) {
        errorMessage = String((error as { message: unknown }).message)
      } else if ('name' in error) {
        errorMessage = String((error as { name: unknown }).name)
      } else {
        errorMessage = JSON.stringify(error)
      }
    } else {
      errorMessage = String(error)
    }
    log.error('Failed to fetch inference profile ARNs from CloudFormation:', {
      error,
      errorType: typeof error,
      isErrorInstance: error instanceof Error,
      errorMessage,
      stage,
      stackName,
    })
    throw new Error(`Failed to fetch inference profile ARNs: ${errorMessage}`)
  }
}

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

type SendChatRequestParams = {
  agent: Agent
  systemPrompt: string
  basePrompt: string
  conversation: Conversation
  responseFormat: ZodType<unknown, ZodTypeDef, unknown>
}

export const sendChatRequest = async ({
  agent,
  systemPrompt,
  basePrompt,
  conversation,
  responseFormat,
}: SendChatRequestParams) => {
  systemPrompt = systemPrompt + basePrompt

  // Convert the Zod schema to JSON schema for the AWS Bedrock runtime
  // The `zodToJsonSchema` function freaks typescript out.
  const jsonSchema = zodToJsonSchema(responseFormat, 'json')

  const filteredConversation = agent.filterHistoryStrategy ? agent.filterHistoryStrategy(conversation) : conversation
  const inputSchema = jsonSchema.definitions as ToolInputSchema | undefined
  const prependedConversation = [{ text: 'Hi', metadata: { source: MessageSender.USER } }, ...filteredConversation]
  const mergedMessages = mergeSequentialMessages(prependedConversation)

  const models = await fetchInferenceProfileArns()

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
