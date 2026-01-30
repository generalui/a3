import { Conversation, MessageMetadata } from 'types/chat'
import { AgentId } from 'types/agent'
import { BaseState } from 'types/state'
import { SessionStore } from 'types/storage'

export interface ChatContext {
  [key: string]: unknown
}

export interface SessionData<TState extends BaseState = BaseState> {
  sessionId: string
  messages: Conversation
  conversationHistory?: Conversation // Stores previous messages when re-authenticating
  activeAgentId: AgentId | null
  state: TState // Contains state variables agents use to make decisions
  chatContext: ChatContext // Contains context variables regarding the current needed data.
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
export interface ChatSessionConfig<TState extends BaseState = BaseState> {
  /** Unique session identifier */
  sessionId: string

  /** Storage adapter for session persistence */
  store?: SessionStore<TState>

  /** Initial agent to start the conversation */
  initialAgentId: AgentId

  /** Initial state (used when creating new sessions) */
  initialState?: TState

  /** Initial chat context (used when creating new sessions) */
  initialChatContext?: Record<string, unknown>
}
