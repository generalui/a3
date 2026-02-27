import { ConverseStreamOutput } from '@aws-sdk/client-bedrock-runtime'
import { EventType } from '@ag-ui/client'
import { ZodType } from 'zod'
import { AgentId, StreamEvent, BaseState } from 'types'
import { log } from '@utils/logger'

export async function* processBedrockStream<TState extends BaseState = BaseState>(
  rawStream: AsyncIterable<ConverseStreamOutput>,
  agentId: AgentId,
  schema: ZodType,
): AsyncGenerator<StreamEvent<TState>> {
  let currentBlockType: 'text' | 'toolUse' | null = null
  let toolInputBuffer = ''

  for await (const event of rawStream) {
    // --- Content block start: determine block type ---
    if (event.contentBlockStart) {
      if (event.contentBlockStart.start?.toolUse) {
        currentBlockType = 'toolUse'
        toolInputBuffer = ''
      } else {
        currentBlockType = 'text'
      }
      continue
    }

    // --- Content block delta: text or tool input ---
    if (event.contentBlockDelta) {
      const delta = event.contentBlockDelta.delta
      if (!delta) continue

      // Infer block type from delta content if no contentBlockStart was received
      // (Bedrock may omit contentBlockStart for the first text block)
      if (delta.text && (currentBlockType === 'text' || currentBlockType === null)) {
        currentBlockType = 'text'
        yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId: '', delta: delta.text, agentId } as StreamEvent<TState>
      } else if (delta.toolUse && (currentBlockType === 'toolUse' || currentBlockType === null)) {
        currentBlockType = 'toolUse'
        toolInputBuffer += delta.toolUse.input ?? ''
      }
      continue
    }

    // --- Content block stop: parse and validate tool call ---
    if (event.contentBlockStop) {
      if (currentBlockType === 'toolUse' && toolInputBuffer) {
        yield parseToolCall<TState>(toolInputBuffer, schema, agentId)
        toolInputBuffer = ''
      }
      currentBlockType = null
      continue
    }

    // --- Metadata: log usage ---
    if (event.metadata) {
      log.debug('Stream metadata', { agentId, usage: event.metadata.usage, metrics: event.metadata.metrics })
      continue
    }

    // --- Error events: throw to surface to caller ---
    throwIfStreamError(event)
  }
}

function parseToolCall<TState extends BaseState>(
  toolInputBuffer: string,
  schema: ZodType,
  agentId: AgentId,
): StreamEvent<TState> {
  try {
    const parsed = JSON.parse(toolInputBuffer) as Record<string, unknown>
    const validated = schema.parse(parsed)
    return {
      type: EventType.TOOL_CALL_RESULT,
      toolCallId: '',
      messageId: '',
      content: JSON.stringify(validated),
      agentId,
    } as StreamEvent<TState>
  } catch (err) {
    log.error('Failed to parse/validate tool call from stream', { agentId, error: err })
    return {
      type: EventType.RUN_ERROR,
      message: `Tool call parse/validation failed: ${(err as Error).message}`,
      agentId,
    } as StreamEvent<TState>
  }
}

function throwIfStreamError(event: ConverseStreamOutput): void {
  if (event.internalServerException) {
    throw new Error(`Bedrock internal error: ${event.internalServerException.message}`)
  }
  if (event.modelStreamErrorException) {
    throw new Error(`Bedrock model stream error: ${event.modelStreamErrorException.message}`)
  }
  if (event.throttlingException) {
    throw new Error(`Bedrock throttling: ${event.throttlingException.message}`)
  }
  if (event.validationException) {
    throw new Error(`Bedrock validation error: ${event.validationException.message}`)
  }
  if (event.serviceUnavailableException) {
    throw new Error(`Bedrock service unavailable: ${event.serviceUnavailableException.message}`)
  }
}
