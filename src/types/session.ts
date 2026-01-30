import { Conversation } from 'types/chat'
import { AgentId } from 'types/agent'
import { BaseState } from 'types/state'

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
