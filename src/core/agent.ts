import { basePrompt } from '../../agents/basePrompt'
import { widgetPrompt } from '../../agents/widgetPrompt'
import { createFullOutputSchema } from '@core/schemas'
import { EventType } from '@ag-ui/client'
import {
  BaseState,
  BaseChatContext,
  GenerateResponseSpecification,
  FlowInput,
  StreamEvent,
  Agent,
  AgentResponseResult,
  SessionData,
  Provider,
  ProviderMessage,
} from 'types'
import { getLogger } from '@utils/logger'

/**
 * Resolves the provider for an agent request.
 * Agent-level provider takes precedence over session-level provider.
 *
 * @param agent - The agent (may have its own provider)
 * @param sessionProvider - The session-level provider (fallback)
 * @returns The resolved provider instance
 */
export function resolveProvider<TState extends BaseState, TContext extends BaseChatContext>(
  agent: Agent<TState, TContext>,
  sessionProvider: Provider,
): Provider {
  return agent.provider ?? sessionProvider
}

/**
 * Converts conversation messages to provider-agnostic format.
 */
function toProviderMessages(conversation: { text: string; metadata?: { source?: string } }[]): ProviderMessage[] {
  return conversation
    .filter((msg) => msg.text)
    .map((msg) => ({
      role: msg.metadata?.source === 'assistant' ? 'assistant' : 'user',
      content: msg.text,
    }))
}

export const prepareAgentRequest = async <
  TState extends BaseState,
  TContext extends BaseChatContext = BaseChatContext,
>({
  agent,
  sessionData,
  lastAgentUnsentMessage,
  stream,
  provider,
}: FlowInput<TState, TContext>) => {
  const dynamicPrompt =
    typeof agent.prompt === 'string'
      ? agent.prompt
      : await agent.prompt({
          agent,
          sessionData,
          lastAgentUnsentMessage,
          stream,
          provider,
        })
  // Resolve widgets (supports both static record and function form)
  const resolvedWidgets = typeof agent.widgets === 'function' ? agent.widgets(sessionData) : agent.widgets

  // Automatically inject transition context when agent was invoked via a transition
  const transitionContext = lastAgentUnsentMessage
    ? `\n\n[Transition Context]\nYou are now the active agent. The last assistant message in the conversation history was sent by a DIFFERENT agent (not you). That agent's response ("${lastAgentUnsentMessage}") is already visible to the user. Continue the conversation seamlessly and proceed directly with YOUR goal.`
    : ''

  const systemPrompt = `${dynamicPrompt}${transitionContext}\n${widgetPrompt({ ...agent, widgets: resolvedWidgets })}`

  // Get the consumer's output schema
  const outputSchema = typeof agent.outputSchema === 'function' ? agent.outputSchema(sessionData) : agent.outputSchema

  // Merge with base fields to create the full output schema
  // When transition is an array, constrain redirectToAgent to those agent IDs (LLM decides).
  // When transition is a function, don't expose redirectToAgent — routing is code-controlled.
  const transitionTargets = Array.isArray(agent.transition) ? agent.transition : undefined
  const isDeterministicRouting = typeof agent.transition === 'function'
  // Suppress redirectToAgent on the first turn after a transition to prevent immediate bounce-back
  const suppressRedirect = !!lastAgentUnsentMessage
  const fullOutputSchema = createFullOutputSchema(
    outputSchema,
    transitionTargets,
    resolvedWidgets,
    isDeterministicRouting || suppressRedirect,
  )

  return { systemPrompt, fullOutputSchema }
}

export const getAgentResponse = async <TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>(
  input: FlowInput<TState, TContext>,
) => {
  const { agent, sessionData } = input
  const { systemPrompt, fullOutputSchema } = await prepareAgentRequest(input)
  const logger = input.logger ?? getLogger()
  logger.withMetadata({ agentId: agent.id, sessionId: sessionData.sessionId }).debug('Generating agent response')

  const provider = resolveProvider(agent, input.provider)
  const filteredConversation = agent.filterHistoryStrategy
    ? agent.filterHistoryStrategy(sessionData.messages)
    : sessionData.messages
  const messages = toProviderMessages(filteredConversation)

  const response = await provider.sendRequest({
    systemPrompt: systemPrompt + basePrompt(agent, sessionData),
    messages,
    responseSchema: fullOutputSchema,
  })
  return fullOutputSchema.parse(JSON.parse(response.content))
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

  // Deterministic routing (function): code decides, ignore LLM's redirectToAgent.
  // Non-deterministic routing (array) or absent: use LLM's redirectToAgent, default to staying on current agent.
  const nextAgentId =
    typeof agent.transition === 'function' ? agent.transition(newState, goalAchieved) : redirectToAgent || agent.id

  return {
    newState,
    chatbotMessage,
    goalAchieved,
    nextAgentId,
    widgets,
  }
}

export const simpleAgentResponse = async <TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>(
  input: FlowInput<TState, TContext>,
): Promise<Awaited<ReturnType<GenerateResponseSpecification<TState, TContext>>>> => {
  const res = await getAgentResponse(input)
  return processAgentResponseData(input.agent, input.sessionData, res)
}

export async function* getAgentResponseStream<
  TState extends BaseState,
  TContext extends BaseChatContext = BaseChatContext,
>(input: FlowInput<TState, TContext>): AsyncGenerator<StreamEvent<TState>> {
  const { agent, sessionData } = input
  const { systemPrompt, fullOutputSchema } = await prepareAgentRequest(input)
  const logger = input.logger ?? getLogger()
  logger.withMetadata({ agentId: agent.id, sessionId: sessionData.sessionId }).debug('Generating agent response (stream)')

  const provider = resolveProvider(agent, input.provider)
  const filteredConversation = agent.filterHistoryStrategy
    ? agent.filterHistoryStrategy(sessionData.messages)
    : sessionData.messages
  const messages = toProviderMessages(filteredConversation)

  yield* provider.sendRequestStream<TState>({
    systemPrompt: systemPrompt + basePrompt(agent, sessionData),
    messages,
    responseSchema: fullOutputSchema,
  })
}

export async function* simpleAgentResponseStream<
  TState extends BaseState,
  TContext extends BaseChatContext = BaseChatContext,
>(input: FlowInput<TState, TContext>): AsyncGenerator<StreamEvent<TState>, AgentResponseResult<TState>> {
  let toolCallData: Record<string, unknown> | null = null
  let activeMessageId: string | null = null

  for await (const event of getAgentResponseStream(input)) {
    if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
      // Open a text message on first content delta
      if (activeMessageId === null) {
        activeMessageId = crypto.randomUUID()
        yield {
          type: EventType.TEXT_MESSAGE_START,
          messageId: activeMessageId,
          role: 'assistant',
        } as StreamEvent<TState>
      }
      yield { ...event, messageId: activeMessageId } as StreamEvent<TState>
    } else if (event.type === EventType.TOOL_CALL_RESULT) {
      // Close any open text message before non-text events
      if (activeMessageId !== null) {
        yield { type: EventType.TEXT_MESSAGE_END, messageId: activeMessageId } as StreamEvent<TState>
        activeMessageId = null
      }
      toolCallData = JSON.parse(event.content) as Record<string, unknown>
      yield event
    } else if (event.type === EventType.RUN_ERROR) {
      if (activeMessageId !== null) {
        yield { type: EventType.TEXT_MESSAGE_END, messageId: activeMessageId } as StreamEvent<TState>
        activeMessageId = null
      }
      yield event
    }
  }

  // Close any still-open text message at end of stream
  if (activeMessageId !== null) {
    yield { type: EventType.TEXT_MESSAGE_END, messageId: activeMessageId } as StreamEvent<TState>
  }

  if (!toolCallData) {
    throw new Error('Stream completed without tool call data')
  }

  return processAgentResponseData(input.agent, input.sessionData, toolCallData)
}
