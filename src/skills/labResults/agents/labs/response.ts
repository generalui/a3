import { LAB_RESULTS_MESSAGES } from '@constants/messages'
import { getAgentResponse } from '@core/agent'
import {
  AgentIdOrEmpty,
  GenerateAgentResponseSpecification,
  AgentId,
  FlowInput,
  ChatState,
} from 'types'
import { MessageMetadata } from 'types/chat'
import { Events } from 'types/events'
import { logEvent } from '@utils/eventLogger'
import { log } from '@utils/logger'
import { LabsResponse } from '.'
import { documentsTool } from './tools'

export const generateAgentResponse: GenerateAgentResponseSpecification = async ({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput) => {
  const res = (await getAgentResponse({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })) as LabsResponse

  const { authenticationPassed, documentsSent, goalAchieved } = sessionData.chatState
  let { chatbotMessage } = res

  let messageMetadata: MessageMetadata | undefined
  let metadataSuccessfullyGenerated = false

  if (authenticationPassed && !documentsSent && res.conversationPayload.shouldProvideDocuments) {
    const toolResult = await documentsTool(sessionData)
    if (toolResult.status === 'success') {
      messageMetadata = toolResult.content as MessageMetadata
      metadataSuccessfullyGenerated = true
    } else {
      chatbotMessage = `${LAB_RESULTS_MESSAGES.ERROR_SENDING_DOCUMENT}: ${toolResult.content as string}`
      metadataSuccessfullyGenerated = false
    }
  }

  const newData: ChatState = {
    ...sessionData.chatState,
  }

  let nextAgentId: AgentIdOrEmpty = ''

  if (!authenticationPassed) {
    newData.requestingAgent = AgentId.LAB_RESULTS
    nextAgentId = AgentId.AUTH
  } else if (!documentsSent) {
    newData.documentsSent = metadataSuccessfullyGenerated
    nextAgentId = AgentId.LAB_RESULTS
  } else {
    // Reset flag on transitioning out
    newData.documentsSent = false
    nextAgentId = AgentId.WRAP_UP
  }

  // Logging
  if (metadataSuccessfullyGenerated) {
    log.debug(`generateAgentResponse: Logging ${Events.DocumentMessageSent} event`, { messageMetadata })
    void logEvent(Events.DocumentMessageSent, { messageMetadata })
  }

  return {
    newChatState: newData,
    chatbotMessage,
    messageMetadata,
    goalAchieved,
    nextAgentId,
  }
}
