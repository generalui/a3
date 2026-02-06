import { Conversation, Message, MessageMetadata } from 'types/chat'
import { AgentId } from 'types/agent'
import { SessionStore } from 'types/storage'

/**
 * BaseState defines the minimum required fields for state.
 * Consumers extend this interface with their own properties.
 *
 * Note: State is GLOBAL across all agents in a session. All agents
 * share the same state object, enabling cross-agent data flow.
 */
export interface BaseState {
  [key: string]: unknown // Allow extension
}

/**
 * BaseChatContext defines the minimum required fields for chat context.
 * Consumers extend this interface with their own properties
 */
export interface BaseChatContext {
  [key: string]: unknown
}

export interface SessionData<TState extends BaseState = BaseState, TContext extends BaseChatContext = BaseChatContext> {
  sessionId: string
  messages: Conversation
  conversationHistory?: Conversation // Stores previous messages when re-authenticating
  activeAgentId: AgentId | null
  state: TState // Contains state variables agents use to make decisions
  chatContext: TContext // Contains context variables regarding the current needed data.
}

/**
 * Response from ChatSession.send()
 */
export interface ChatResponse<TState extends BaseState = BaseState> {
  responseMessage: string
  messageMetadata?: MessageMetadata
  activeAgentId: AgentId | null
  nextAgentId: AgentId | null
  state: TState
  goalAchieved: boolean
  sessionId: string
}

/**
 * Configuration for creating a ChatSession
 */
export interface ChatSessionConfig<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> {
  /** Unique session identifier */
  sessionId: string

  /** Storage adapter for session persistence */
  store?: SessionStore<TState, TContext>

  /** Initial agent to start the conversation */
  initialAgentId: AgentId

  /** Initial state (used when creating new sessions) */
  initialState?: TState

  /** Initial chat context (used when creating new sessions) */
  initialChatContext?: TContext

  initialMessages?: Message[]
}
