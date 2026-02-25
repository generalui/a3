import { AgentId } from './agent'
import { ChatResponse, BaseState } from './session'

export type StreamEvent<TState extends BaseState = BaseState> =
  | { type: 'RunStarted'; runId?: string; threadId?: string; input?: unknown }
  | { type: 'TextMessageStart'; messageId: string; role?: string }
  | { type: 'TextMessageContent'; delta: string; agentId: AgentId; messageId?: string }
  | { type: 'TextMessageEnd'; messageId: string }
  | { type: 'ToolCallStart'; toolCallId: string; toolCallName: string; parentMessageId?: string }
  | { type: 'ToolCallArgs'; toolCallId: string; delta: string }
  | { type: 'ToolCallEnd'; toolCallId: string }
  | { type: 'ToolCallResult'; data: Record<string, unknown>; agentId: AgentId; toolCallId?: string }
  | { type: 'AgentTransition'; fromAgentId: AgentId; toAgentId: AgentId }
  | { type: 'RunFinished'; response: ChatResponse<TState> }
  | { type: 'RunError'; error: Error; agentId: AgentId }
