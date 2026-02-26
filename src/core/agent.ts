import { basePrompt } from '../../agents/basePrompt'
import { widgetPrompt } from '../../agents/widgetPrompt'
import { createFullOutputSchema } from '@core/schemas'
import { sendChatRequest, sendChatRequestStream } from '@providers/awsBedrock'
import { processBedrockStream } from '@core/streamProcessor'
import {
  BaseState,
  BaseChatContext,
  GenerateAgentResponseSpecification,
  FlowInput,
  StreamEvent,
  Agent,
  AgentResponseResult,
  SessionData,
} from 'types'
import { log } from '@utils/logger'

export const prepareAgentRequest = async <
  TState extends BaseState,
  TContext extends BaseChatContext = BaseChatContext,
>({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput<TState, TContext>) => {
  const dynamicPrompt = await agent.promptGenerator({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })
  // Resolve widgets (supports both static record and function form)
  const resolvedWidgets = typeof agent.widgets === 'function' ? agent.widgets(sessionData) : agent.widgets

  const systemPrompt = `${dynamicPrompt}\n${widgetPrompt({ ...agent, widgets: resolvedWidgets })}`

  // Get the consumer's output schema
  const outputSchema = typeof agent.outputSchema === 'function' ? agent.outputSchema(sessionData) : agent.outputSchema

  // Merge with base fields to create the full output schema
  // If transitionsTo is provided, redirectToAgent will be constrained to those values
  const fullOutputSchema = createFullOutputSchema(outputSchema, agent.transitionsTo, resolvedWidgets)

  return { systemPrompt, fullOutputSchema }
}

export const getAgentResponse = async <TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput<TState, TContext>) => {
  const { systemPrompt, fullOutputSchema } = await prepareAgentRequest({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })
  log.log('agent id:', agent.id)

  const response = await sendChatRequest({
    agent,
    systemPrompt,
    basePrompt: basePrompt(agent, sessionData),
    conversation: sessionData.messages,
    responseFormat: fullOutputSchema,
  })
  return fullOutputSchema.parse(JSON.parse(response))
}

export const processAgentResponseData = <TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>(
  agent: Agent<TState, TContext>,
  sessionData: SessionData<TState, TContext>,
  data: Record<string, unknown>,
) => {
  const newState = agent.setState
    ? agent.setState(data.conversationPayload, sessionData.state)
    : ({ ...sessionData.state, ...(data.conversationPayload as Record<string, unknown>) } as TState)
  const chatbotMessage = (data.chatbotMessage as string) || ''
  const goalAchieved = (data.goalAchieved as boolean) || false
  const redirectToAgent = data.redirectToAgent as string | null | undefined
  let widgets = data.widgets as object | undefined

  if (widgets && typeof widgets === 'object' && Object.keys(widgets).length === 0) {
    widgets = undefined
  }

  const nextAgentId = redirectToAgent ? redirectToAgent : agent.nextAgentSelector?.(newState, goalAchieved) || ''

  return {
    newState,
    chatbotMessage,
    goalAchieved,
    nextAgentId,
    widgets,
  }
}

export const simpleAgentResponse = async <
  TState extends BaseState,
  TContext extends BaseChatContext = BaseChatContext,
>({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput<TState, TContext>): Promise<Awaited<ReturnType<GenerateAgentResponseSpecification<TState, TContext>>>> => {
  const res = await getAgentResponse({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })

  return processAgentResponseData(agent, sessionData, res)
}

export async function* getAgentResponseStream<
  TState extends BaseState,
  TContext extends BaseChatContext = BaseChatContext,
>({ agent, sessionData, lastAgentUnsentMessage }: FlowInput<TState, TContext>): AsyncGenerator<StreamEvent<TState>> {
  const { systemPrompt, fullOutputSchema } = await prepareAgentRequest({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })
  log.log('agent id (stream):', agent.id)

  const rawStream = await sendChatRequestStream({
    agent,
    systemPrompt,
    basePrompt: basePrompt(agent, sessionData),
    conversation: sessionData.messages,
    responseFormat: fullOutputSchema,
  })
  yield* processBedrockStream<TState>(rawStream, agent.id, fullOutputSchema)
}

export async function* simpleAgentResponseStream<
  TState extends BaseState,
  TContext extends BaseChatContext = BaseChatContext,
>({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput<TState, TContext>): AsyncGenerator<StreamEvent<TState>, AgentResponseResult<TState>> {
  let toolCallData: Record<string, unknown> | null = null

  for await (const event of getAgentResponseStream({ agent, sessionData, lastAgentUnsentMessage })) {
    if (event.type === 'TextMessageContent') {
      yield event
    } else if (event.type === 'ToolCallResult') {
      toolCallData = event.data
      yield event
    } else if (event.type === 'RunError') {
      yield event
    }
  }

  if (!toolCallData) {
    throw new Error('Stream completed without tool call data')
  }

  return processAgentResponseData(agent, sessionData, toolCallData)
}
