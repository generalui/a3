import { basePrompt } from '../../agents/basePrompt'
import { widgetPrompt } from '../../agents/widgetPrompt'
import { createFullOutputSchema } from '@core/schemas'
import { sendChatRequest } from '@providers/awsBedrock'
import { BaseState, BaseChatContext, GenerateAgentResponseSpecification, FlowInput } from 'types'
import { log } from '@utils/logger'

export const getAgentResponse = async <TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>({
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
  log.log('agent id:', agent.id)

  // Get the consumer's output schema
  const outputSchema = typeof agent.outputSchema === 'function' ? agent.outputSchema(sessionData) : agent.outputSchema

  // Merge with base fields to create the full output schema
  // If transitionsTo is provided, redirectToAgent will be constrained to those values
  const fullOutputSchema = createFullOutputSchema(outputSchema, agent.transitionsTo, resolvedWidgets)

  const response = await sendChatRequest({
    agent,
    systemPrompt,
    basePrompt: basePrompt(agent, sessionData),
    conversation: sessionData.messages,
    responseFormat: fullOutputSchema,
  })
  return fullOutputSchema.parse(JSON.parse(response))
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

  const newData = agent.fitDataInGeneralFormat(res.conversationPayload, sessionData.state)

  const nextAgentId = res.redirectToAgent
    ? res.redirectToAgent
    : agent.nextAgentSelector?.(newData, res.goalAchieved) || ''

  return {
    newState: newData,
    chatbotMessage: res.chatbotMessage,
    goalAchieved: res.goalAchieved,
    nextAgentId,
    widgets:
      res.widgets && typeof res.widgets === 'object' && Object.keys(res.widgets).length > 0 ? res.widgets : undefined,
  }
}
