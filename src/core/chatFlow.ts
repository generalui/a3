import { AgentRegistry } from '@core/AgentRegistry'
import { initialGeneralData } from '@core/schemas'
import { ChatState, AgentId, FlowInput } from 'types'
import { MessageMetadata } from 'types/chat'
import { Events } from 'types/events'
import { logEvent } from '@utils/eventLogger'
import { log } from '@utils/logger'

const getAgents = () => AgentRegistry.getInstance().getAll()

const conversationData: ChatState = { ...initialGeneralData, goalAchieved: false }

export const manageFlow = async ({
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput): Promise<{
  responseMessage: string
  messageMetadata?: MessageMetadata
  newChatState: ChatState
  activeAgentId: AgentId | null
  nextAgentId: AgentId | null
}> => {
  const { activeAgentId } = sessionData
  const agents = getAgents()
  const activeAgent = agents.find((agent) => agent.id === activeAgentId)
  if (activeAgent === undefined) {
    return {
      responseMessage: 'No active agent',
      newChatState: conversationData,
      activeAgentId: null,
      nextAgentId: null,
    }
  }
  log.log('activeAgent:', activeAgent.id)
  const { newChatState, chatbotMessage, nextAgentId, messageMetadata } = await activeAgent.generateAgentResponse({
    agent: activeAgent,
    sessionData,
    lastAgentUnsentMessage,
  })

  const nextAgent = agents.find((agent) => agent.id === nextAgentId)

  const nextAgentDifferentFromActiveAgent = nextAgent?.id !== activeAgent.id && nextAgent !== undefined
  if (nextAgentDifferentFromActiveAgent) {
    log.debug(`manageFlow: Logging ${Events.AgentChanged} event`, {
      activeAgent: activeAgent.id,
      nextAgent: nextAgent.id,
    })
    void logEvent(Events.AgentChanged, { activeAgent: activeAgent.id, nextAgent: nextAgent.id })
    return manageFlow({
      agent: nextAgent,
      sessionData: {
        ...sessionData,
        activeAgentId: nextAgent.id,
        chatState: newChatState,
      },
      lastAgentUnsentMessage: chatbotMessage,
    })
  }
  return {
    responseMessage: chatbotMessage,
    messageMetadata,
    newChatState,
    activeAgentId: activeAgent.id,
    nextAgentId,
  }
}
