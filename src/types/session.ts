import { Conversation } from 'types/chat'
import { AgentId } from 'types/agent'
import { ChatState } from 'types/payloads'

export interface ChatContext {
  [key: string]: unknown
}

export interface SessionData {
  sessionId: string
  messages: Conversation
  conversationHistory?: Conversation // Stores previous messages when re-authenticating
  activeAgentId: AgentId | null
  chatState: ChatState // Contains state variables agents use to make decisions
  chatContext: ChatContext // Contains context variables regarding the current needed data.
}
