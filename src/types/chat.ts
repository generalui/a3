import { Widget } from 'types/widget'

export enum ToolName {
  Tool1 = 'tool1',
}

export type MessageMetadata = {
  source: MessageSender
  timestamp?: number
  widget?: Widget
  redirectTo?: string
}

export type AgUIEvent = {
  component: string
  data?: Record<string, unknown>
}

export type Message = {
  text: string
  metadata?: MessageMetadata
  agUIEvents?: AgUIEvent[]
  isStreaming?: boolean
  isError?: boolean
  executingTools?: ToolName[]
  messageId?: string
}

export enum MessageSender {
  ASSISTANT = 'assistant',
  USER = 'user',
}

export type Conversation = Message[]

export type ToolResult<T> = {
  content: T
  status: 'success' | 'error'
}
