import { EventType } from '@ag-ui/client'
import { ZodType } from 'zod'
import type { AgentId, StreamEvent, BaseState } from '@genui-a3/a3'
import type { StreamTextResult, ToolSet } from 'ai'

/**
 * Processes an OpenAI streaming response (via Vercel AI SDK) into AG-UI events.
 *
 * Uses `partialOutputStream` from `streamText` + `Output.object()` to receive
 * progressively-built partial objects. Tracks `chatbotMessage` growth to yield
 * TEXT_MESSAGE_CONTENT deltas. After the stream completes, validates the final
 * object and yields TOOL_CALL_RESULT.
 *
 * @param streamResult - The streamText result containing partialOutputStream and output promise
 * @param reader - Pre-started async iterator for the partial object stream
 * @param first - The first iteration result (already consumed to trigger the API call)
 * @param agentId - Agent identifier for event tagging
 * @param schema - Zod schema for final response validation
 * @returns Async generator of AG-UI stream events
 */
export async function* processOpenAIStream<TState extends BaseState = BaseState>(
  streamResult: StreamTextResult<ToolSet, never>,
  reader: AsyncIterator<unknown>,
  first: IteratorResult<unknown>,
  agentId: AgentId,
  schema: ZodType,
): AsyncGenerator<StreamEvent<TState>> {
  let prevMessageLength = 0

  try {
    // Process the first partial (already consumed to trigger the API call)
    if (!first.done) {
      const partial = first.value as Record<string, unknown>
      const delta = extractDelta(partial, prevMessageLength)
      if (delta) {
        prevMessageLength += delta.length
        yield {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: '',
          delta,
          agentId,
        } as StreamEvent<TState>
      }
    }

    // Process remaining partials
    let next = await reader.next()
    while (!next.done) {
      const partial = next.value as Record<string, unknown>
      const delta = extractDelta(partial, prevMessageLength)
      if (delta) {
        prevMessageLength += delta.length
        yield {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: '',
          delta,
          agentId,
        } as StreamEvent<TState>
      }
      // eslint-disable-next-line no-await-in-loop
      next = await reader.next()
    }

    // Stream complete — await and validate the final object
    const finalObject = await streamResult.output

    if (finalObject === null) {
      yield {
        type: EventType.RUN_ERROR,
        message: 'OpenAI stream completed with null output',
        agentId,
      } as StreamEvent<TState>
      return
    }

    const validated = schema.parse(finalObject)
    yield {
      type: EventType.TOOL_CALL_RESULT,
      toolCallId: '',
      messageId: '',
      content: JSON.stringify(validated),
      agentId,
    } as StreamEvent<TState>
  } catch (err) {
    yield {
      type: EventType.RUN_ERROR,
      message: `OpenAI stream error: ${(err as Error).message}`,
      agentId,
    } as StreamEvent<TState>
  }
}

/**
 * Extracts the new portion of chatbotMessage from a partial object.
 */
function extractDelta(partial: Record<string, unknown>, prevLength: number): string | null {
  const chatbotMessage = partial.chatbotMessage
  if (typeof chatbotMessage !== 'string' || chatbotMessage.length <= prevLength) {
    return null
  }
  return chatbotMessage.slice(prevLength)
}
