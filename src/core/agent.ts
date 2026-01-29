import { basePrompt } from '../../agents/basePrompt'
import { BaseResponse, createFullOutputSchema } from '@core/schemas'
import { sendChatRequest } from '@providers/awsBedrock'
import { BaseState, GenerateAgentResponseSpecification, FlowInput } from 'types'
import { log } from '@utils/logger'

export const getAgentResponse = async <TState extends BaseState>({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput<TState>) => {
  const systemPrompt = await agent.promptGenerator({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })
  log.log('agent id:', agent.id)

  // Get the consumer's output schema
  const outputSchema = typeof agent.outputSchema === 'function' ? agent.outputSchema(sessionData) : agent.outputSchema

  // Merge with base fields to create the full output schema
  // If transitionsTo is provided, redirectToAgent will be constrained to those values
  const fullOutputSchema = createFullOutputSchema(outputSchema, agent.transitionsTo)

  const response = await sendChatRequest({
    agent,
    systemPrompt,
    basePrompt: basePrompt(agent, sessionData),
    conversation: sessionData.messages,
    responseFormat: fullOutputSchema,
  })
  return fullOutputSchema.parse(JSON.parse(response)) as BaseResponse
}

export const simpleAgentResponse = async <TState extends BaseState>({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput<TState>): Promise<Awaited<ReturnType<GenerateAgentResponseSpecification<TState>>>> => {
  const res = await getAgentResponse({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })

  const newData = agent.fitDataInGeneralFormat(res.conversationPayload, sessionData.state)

  const nextAgentId = res.redirectToAgent
    ? res.redirectToAgent
    : agent.nextAgentSelector?.(res.conversationPayload as TState, res.goalAchieved) || ''
  return {
    newState: newData,
    chatbotMessage: res.chatbotMessage,
    goalAchieved: res.goalAchieved,
    nextAgentId,
  }
}
