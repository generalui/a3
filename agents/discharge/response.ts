import { DISCHARGE_MESSAGES } from '@constants/messages'
import { getAgentResponse } from '@core/agent'
import { AgentIdOrEmpty, GenerateAgentResponseSpecification, AgentId, FlowInput, ChatState, MessageSender } from 'types'
import { MessageMetadata } from 'types/chat'
import { Events } from 'types/events'
import { TokenType } from 'types/token'
import { logEvent } from '@utils/eventLogger'
import { log } from '@utils/logger'
import { sendMessage } from '@/app/actions/messageActions'
import { documentsTool } from './tools'
import { DischargeResponse } from './index'

export const generateAgentResponse: GenerateAgentResponseSpecification = async ({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput) => {
  const res = (await getAgentResponse({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })) as DischargeResponse

  const { authenticationPassed, documentsSent, goalAchieved } = sessionData.chatState
  let { chatbotMessage } = res

  let messageMetadata: MessageMetadata | undefined
  let metadataSuccessfullyGenerated = false

  if (authenticationPassed && !documentsSent && res.conversationPayload.shouldProvideDocuments) {
    const documents = await documentsTool(sessionData)
    if (documents.status === 'success') {
      messageMetadata = documents.content
      metadataSuccessfullyGenerated = true
    } else {
      chatbotMessage = DISCHARGE_MESSAGES.ERROR_SENDING_DOCUMENT
      metadataSuccessfullyGenerated = false
    }
  }

  const newData: ChatState = {
    ...sessionData.chatState,
  }

  let nextAgentId: AgentIdOrEmpty = ''

  if (!authenticationPassed) {
    newData.requestingAgent = AgentId.DISCHARGE
    nextAgentId = AgentId.AUTH
  } else if (!documentsSent) {
    newData.documentsSent = metadataSuccessfullyGenerated
    nextAgentId = AgentId.DISCHARGE
    // Hidden messages are a temporal feature meant only to prompt the prescription poc agent to continue the conversation
    if (sessionData.tokenType === TokenType.PRESCRIPTION_POC) {
      setTimeout(() => {
        void sendMessage({ message: { text: '[hidden text]', metadata: { source: MessageSender.USER } } }, null, true)
      }, 3000)
    }
  } else {
    // Reset flag on transitioning out of discharge
    newData.documentsSent = false
    if (sessionData.tokenType === TokenType.PRESCRIPTION_POC) {
      nextAgentId = AgentId.PRESCRIPTION_MANAGEMENT
    } else {
      nextAgentId = AgentId.WRAP_UP
    }
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
