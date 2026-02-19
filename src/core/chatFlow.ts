import { AgentRegistry } from '@core/AgentRegistry'
import { BaseState, BaseChatContext, AgentId, FlowInput } from 'types'
import { MessageMetadata } from 'types/chat'
import { Events } from 'types/events'
import { logEvent } from '@utils/eventLogger'
import { log } from '@utils/logger'

export const manageFlow = async <TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>({
  sessionData,
  lastAgentUnsentMessage,
  _depth = 0,
}: FlowInput<TState, TContext> & { _depth?: number }): Promise<{
  responseMessage: string
  newState: TState
  activeAgentId: AgentId | null
  nextAgentId: AgentId | null
  goalAchieved: boolean
  messageMetadata?: MessageMetadata
  widgets?: object
}> => {
  const MAX_AUTO_TRANSITIONS = 10
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
  const { newState, chatbotMessage, nextAgentId, goalAchieved, ...rest } = await activeAgent.generateAgentResponse({
    agent: activeAgent,
    sessionData,
    lastAgentUnsentMessage,
  })

  // console.log(
  //   '📢[chatFlow.ts:40]',
  //   JSON.stringify(
  //     {
  //       activeAgent: activeAgentId,
  //       messages: sessionData.messages,
  //       newState,
  //       chatbotMessage,
  //       nextAgentId,
  //       goalAchieved,
  //       ...rest,
  //     },
  //     null,
  //     2,
  //   ),
  // )

  const nextAgent = agents.find((a) => a.id === nextAgentId)

  const nextAgentDifferentFromActiveAgent = nextAgent?.id !== activeAgent.id && nextAgent !== undefined
  if (nextAgentDifferentFromActiveAgent) {
    if (_depth >= MAX_AUTO_TRANSITIONS) {
      log.warn(
        `manageFlow: Max auto-transitions (${MAX_AUTO_TRANSITIONS}) reached. Stopping to prevent infinite loop.`,
        {
          activeAgent: activeAgent.id,
          nextAgent: nextAgent.id,
          depth: _depth,
        },
      )
      return {
        responseMessage: chatbotMessage,
        newState,
        activeAgentId: activeAgent.id,
        nextAgentId: nextAgent.id,
        goalAchieved,
        ...rest,
      }
    }
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
      _depth: _depth + 1,
    })
  }
  return {
    responseMessage: chatbotMessage,
    newState,
    activeAgentId: activeAgent.id,
    nextAgentId,
    goalAchieved,
    ...rest,
  }
}
