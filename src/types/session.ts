import { Conversation } from 'types/chat'
import { AgentIdOrEmpty } from 'types/agent'
import { ChatState } from 'types/payloads'

export interface ChatContext {
  [key: string]: unknown
}

export interface SessionData {
  sessionId: string
  practiceId: string
  patientId: string
  clinicId: string
  visitId: string
  messages: Conversation
  conversationHistory?: Conversation // Stores previous messages when re-authenticating
  activeAgentId: AgentIdOrEmpty
  chatState: ChatState // Contains state variables agents use to make decisions
  chatContext: ChatContext // Contains context variables regarding the current needed data.
}
