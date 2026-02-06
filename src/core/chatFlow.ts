import { AgentRegistry } from '@core/AgentRegistry'
import { BaseState, BaseChatContext, AgentId, FlowInput } from 'types'
import { MessageMetadata } from 'types/chat'
import { Events } from 'types/events'
import { logEvent } from '@utils/eventLogger'
import { log } from '@utils/logger'

export const manageFlow = async <TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>({
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput<TState, TContext>): Promise<{
  responseMessage: string
  messageMetadata?: MessageMetadata
  newState: TState
  activeAgentId: AgentId | null
  nextAgentId: AgentId | null
  goalAchieved: boolean
}> => {
  const { activeAgentId } = sessionData
  const agents = AgentRegistry.getInstance<TState, TContext>().getAll()
  const activeAgent = agents.find((a) => a.id === activeAgentId)
  if (activeAgent === undefined) {
    return {
      responseMessage: 'No active agent',
      newState: sessionData.state,
      activeAgentId: null,
      nextAgentId: null,
      goalAchieved: false,
    }
  }
  log.log('activeAgent:', activeAgent.id)
  const { newState, chatbotMessage, nextAgentId, messageMetadata, goalAchieved } =
    await activeAgent.generateAgentResponse({
      agent: activeAgent,
      sessionData,
      lastAgentUnsentMessage,
    })

  const nextAgent = agents.find((a) => a.id === nextAgentId)

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
        state: newState,
      },
      lastAgentUnsentMessage: chatbotMessage,
    })
  }
  return {
    responseMessage: chatbotMessage,
    messageMetadata,
    newState,
    activeAgentId: activeAgent.id,
    nextAgentId,
    goalAchieved,
  }
}
