import { AgentRegistry } from '@core/AgentRegistry'
import { simpleAgentResponseStream, simpleAgentResponse } from '@core/agent'
import { EventType } from '@ag-ui/client'
import {
  Agent,
  AgentResponseResult,
  BaseState,
  BaseChatContext,
  FlowInput,
  StreamEvent,
  ChatResponse,
  SessionData,
  MessageSender,
} from 'types'
import { Events } from 'types/events'
import { logEvent } from '@utils/eventLogger'
import { log } from '@utils/logger'

const MAX_AUTO_TRANSITIONS = 10

function isAsyncIterable(value: unknown): boolean {
  return Symbol.asyncIterator in Object(value)
}

export const STREAM_REQUIRED_ERROR = (agentId: string) =>
  `Agent "${agentId}" returned a Promise from generateResponse, but streaming was requested (input.stream = true). ` +
  `Return an AsyncGenerator instead, or check input.stream to branch behavior.`

export const BLOCKING_REQUIRED_ERROR = (agentId: string) =>
  `Agent "${agentId}" returned an AsyncGenerator from generateResponse, but blocking was requested (input.stream = false). ` +
  `Return a Promise instead, or check input.stream to branch behavior.`

function validateGenerateResponseResult(result: unknown, stream: boolean, agentId: string): void {
  if (stream && !isAsyncIterable(result)) {
    throw new Error(STREAM_REQUIRED_ERROR(agentId))
  }

  if (!stream && isAsyncIterable(result)) {
    throw new Error(BLOCKING_REQUIRED_ERROR(agentId))
  }
}

type TransitionDecision<TState extends BaseState, TContext extends BaseChatContext> =
  | { action: 'respond'; response: ChatResponse<TState> }
  | {
      action: 'transition'
      nextAgent: Agent<TState, TContext>
      updatedSessionData: SessionData<TState, TContext>
      chatbotMessage: string
      newDepth: number
    }

function resolveTransition<TState extends BaseState, TContext extends BaseChatContext>({
  agents,
  activeAgent,
  agentResult,
  sessionData,
  _depth,
}: {
  agents: Agent<TState, TContext>[]
  activeAgent: Agent<TState, TContext>
  agentResult: AgentResponseResult<TState>
  sessionData: SessionData<TState, TContext>
  _depth: number
}): TransitionDecision<TState, TContext> {
  const { newState, chatbotMessage, goalAchieved, nextAgentId, widgets, ...rest } = agentResult
  const nextAgent = agents.find((a) => a.id === nextAgentId)
  const shouldTransition = nextAgent?.id !== activeAgent.id && nextAgent !== undefined

  if (shouldTransition) {
    if (_depth >= MAX_AUTO_TRANSITIONS) {
      log.warn(`Max auto-transitions (${MAX_AUTO_TRANSITIONS}) reached. Stopping to prevent infinite loop.`, {
        activeAgent: activeAgent.id,
        nextAgent: nextAgent.id,
        depth: _depth,
      })
      return {
        action: 'respond',
        response: {
          responseMessage: chatbotMessage,
          state: newState,
          activeAgentId: activeAgent.id,
          nextAgentId: nextAgent.id,
          goalAchieved,
          sessionId: sessionData.sessionId,
          widgets,
          ...rest,
        } as ChatResponse<TState>,
      }
    }

    log.debug(`Logging ${Events.AgentChanged} event`, {
      activeAgent: activeAgent.id,
      nextAgent: nextAgent.id,
    })
    void logEvent(Events.AgentChanged, { activeAgent: activeAgent.id, nextAgent: nextAgent.id })

    return {
      action: 'transition',
      nextAgent,
      updatedSessionData: {
        ...sessionData,
        activeAgentId: nextAgent.id,
        state: newState,
      },
      chatbotMessage,
      newDepth: _depth + 1,
    }
  }

  return {
    action: 'respond',
    response: {
      responseMessage: chatbotMessage,
      state: newState,
      activeAgentId: activeAgent.id,
      nextAgentId,
      goalAchieved,
      sessionId: sessionData.sessionId,
      widgets,
      ...rest,
    } as ChatResponse<TState>,
  }
}

export async function manageFlow<TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>({
  sessionData,
  lastAgentUnsentMessage,
  stream,
  provider,
  _depth = 0,
}: FlowInput<TState, TContext> & { _depth?: number }): Promise<ChatResponse<TState>> {
  const { activeAgentId } = sessionData
  const agents = AgentRegistry.getInstance<TState, TContext>().getAll()
  const activeAgent = agents.find((a) => a.id === activeAgentId)

  if (activeAgent === undefined) {
    return {
      responseMessage: 'No active agent',
      state: sessionData.state,
      activeAgentId: null,
      nextAgentId: null,
      goalAchieved: false,
      sessionId: sessionData.sessionId,
    }
  }

  log.log('activeAgent:', activeAgent.id)
  const flowInput = { agent: activeAgent, sessionData, lastAgentUnsentMessage, stream, provider }

  let agentResult: AgentResponseResult<TState>

  if (activeAgent.generateResponse) {
    const result = activeAgent.generateResponse(flowInput)
    validateGenerateResponseResult(result, stream, activeAgent.id)
    agentResult = await (result as Promise<AgentResponseResult<TState>>)
  } else {
    agentResult = await simpleAgentResponse(flowInput)
  }

  const decision = resolveTransition({ agents, activeAgent, agentResult, sessionData, _depth })

  if (decision.action === 'transition') {
    return manageFlow({
      agent: decision.nextAgent,
      sessionData: decision.updatedSessionData,
      lastAgentUnsentMessage: decision.chatbotMessage,
      stream,
      provider,
      _depth: decision.newDepth,
    })
  }

  return decision.response
}

export async function* manageFlowStream<TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>({
  sessionData,
  lastAgentUnsentMessage,
  stream,
  provider,
  _depth = 0,
}: FlowInput<TState, TContext> & { _depth?: number }): AsyncGenerator<StreamEvent<TState>> {
  const { activeAgentId } = sessionData
  const agents = AgentRegistry.getInstance<TState, TContext>().getAll()
  const activeAgent = agents.find((a) => a.id === activeAgentId)

  if (activeAgent === undefined) {
    yield {
      type: EventType.RUN_FINISHED,
      threadId: sessionData.sessionId,
      runId: '',
      result: {
        responseMessage: 'No active agent',
        state: sessionData.state,
        activeAgentId: null,
        nextAgentId: null,
        goalAchieved: false,
        sessionId: sessionData.sessionId,
      },
    } as StreamEvent<TState>
    return
  }

  log.log('activeAgent (stream):', activeAgent.id)
  const flowInput = { agent: activeAgent, sessionData, lastAgentUnsentMessage, stream, provider }

  let agentResult: AgentResponseResult<TState>

  if (activeAgent.generateResponse) {
    const result = activeAgent.generateResponse(flowInput)
    validateGenerateResponseResult(result, stream, activeAgent.id)
    agentResult = yield* result as AsyncGenerator<StreamEvent<TState>, AgentResponseResult<TState>>
  } else {
    agentResult = yield* simpleAgentResponseStream(flowInput)
  }

  const decision = resolveTransition({ agents, activeAgent, agentResult, sessionData, _depth })

  if (decision.action === 'transition') {
    decision.updatedSessionData.messages.push({
      text: decision.chatbotMessage,
      metadata: {
        source: MessageSender.ASSISTANT,
        timestamp: Date.now(),
      },
    })
    yield {
      type: EventType.CUSTOM,
      name: 'AgentTransition',
      value: { fromAgentId: activeAgent.id, toAgentId: decision.nextAgent.id },
    } as StreamEvent<TState>
    yield* manageFlowStream({
      agent: decision.nextAgent,
      sessionData: decision.updatedSessionData,
      lastAgentUnsentMessage: decision.chatbotMessage,
      stream,
      provider,
      _depth: decision.newDepth,
    })
    return
  }

  yield {
    type: EventType.RUN_FINISHED,
    threadId: sessionData.sessionId,
    runId: '',
    result: decision.response,
  } as StreamEvent<TState>
}
