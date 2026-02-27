import { EventType } from '@ag-ui/client'
import { AgentId } from './agent'
import { ChatResponse, BaseState } from './session'

export type StreamEvent<TState extends BaseState = BaseState> =
  | { type: EventType.RUN_STARTED; threadId: string; runId: string; parentRunId?: string; input?: unknown }
  | { type: EventType.TEXT_MESSAGE_START; messageId: string; role?: string }
  | { type: EventType.TEXT_MESSAGE_CONTENT; messageId: string; delta: string; agentId?: AgentId }
  | { type: EventType.TEXT_MESSAGE_END; messageId: string }
  | { type: EventType.TOOL_CALL_START; toolCallId: string; toolCallName: string; parentMessageId?: string }
  | { type: EventType.TOOL_CALL_ARGS; toolCallId: string; delta: string }
  | { type: EventType.TOOL_CALL_END; toolCallId: string }
  | {
      type: EventType.TOOL_CALL_RESULT
      toolCallId: string
      messageId: string
      content: string
      agentId?: AgentId
      role?: 'tool'
    }
  | { type: EventType.CUSTOM; name: string; value: unknown }
  | { type: EventType.RUN_FINISHED; threadId: string; runId: string; result?: ChatResponse<TState> }
  | { type: EventType.RUN_ERROR; message: string; code?: string; agentId?: AgentId }
