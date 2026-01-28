import { basePrompt } from '../../agents/basePrompt'
import { BaseResponse } from '@core/schemas'
import { sendChatRequest } from '@providers/awsBedrock'
import { AgentIdOrEmpty, ChatState, GenerateAgentResponseSpecification, FlowInput } from 'types'
import { log } from '@utils/logger'

export const getAgentResponse = async ({ agent, sessionData, lastAgentUnsentMessage }: FlowInput) => {
  const systemPrompt = await agent.promptGenerator({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })
  log.log('agent id:', agent.id)
  const responseFormat =
    typeof agent.responseFormat === 'function' ? agent.responseFormat(sessionData) : agent.responseFormat

  const response = await sendChatRequest({
    agent,
    systemPrompt,
    basePrompt: basePrompt(agent, sessionData),
    conversation: sessionData.messages,
    responseFormat,
  })
  return responseFormat.parse(JSON.parse(response)) as BaseResponse
}

export const simpleAgentResponse: GenerateAgentResponseSpecification = async ({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}) => {
  const res = await getAgentResponse({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })

  const newData = agent.fitDataInGeneralFormat(res.conversationPayload, sessionData.chatState)

  const nextAgentId = res.redirectToAgent
    ? res.redirectToAgent
    : agent.nextAgentSelector?.(res.conversationPayload as ChatState, res.goalAchieved) || ''
  return {
    newChatState: newData,
    chatbotMessage: res.chatbotMessage,
    goalAchieved: res.goalAchieved,
    nextAgentId: nextAgentId as AgentIdOrEmpty,
  }
}
