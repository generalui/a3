import { EventType } from '@ag-ui/client'
import { ZodType } from 'zod'
import type { AgentId, StreamEvent, BaseState } from '@genui-a3/core'
import type { Stream } from 'openai/streaming'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'

/** State-machine states for extracting chatbotMessage from structured JSON stream */
const enum ParserState {
  SEARCHING = 0,
  IN_CHATBOT_MESSAGE = 1,
  PAST_CHATBOT_MESSAGE = 2,
}

const CHATBOT_MESSAGE_KEY = '"chatbotMessage":"'

/**
 * Processes an OpenAI streaming response into AG-UI events.
 *
 * OpenAI structured output returns the entire response as JSON. The chatbotMessage
 * field is embedded within that JSON. This processor uses a character-level state
 * machine to extract chatbotMessage text progressively during streaming, yielding
 * TEXT_MESSAGE_CONTENT deltas in real-time.
 *
 * @param rawStream - OpenAI chat completion stream
 * @param agentId - Agent identifier for event tagging
 * @param schema - Zod schema for final response validation
 * @returns Async generator of AG-UI stream events
 */
export async function* processOpenAIStream<TState extends BaseState = BaseState>(
  rawStream: Stream<ChatCompletionChunk>,
  agentId: AgentId,
  schema: ZodType,
): AsyncGenerator<StreamEvent<TState>> {
  let fullBuffer = ''
  let state: ParserState = ParserState.SEARCHING
  let escapeNext = false

  try {
    for await (const chunk of rawStream) {
      const delta = chunk.choices[0]?.delta?.content
      if (!delta) continue

      for (const char of delta) {
        fullBuffer += char
        const result: CharResult<TState> = processChar<TState>(char, state, escapeNext, fullBuffer, agentId)
        state = result.state
        escapeNext = result.escapeNext
        if (result.event) yield result.event
      }

      // Check for truncation
      const finishReason = chunk.choices[0]?.finish_reason
      if (finishReason === 'length') {
        yield {
          type: EventType.RUN_ERROR,
          message: 'OpenAI response truncated (finish_reason: length)',
          agentId,
        } as StreamEvent<TState>
        return
      }
    }

    // Stream complete — parse and validate the full response
    if (!fullBuffer) {
      yield {
        type: EventType.RUN_ERROR,
        message: 'OpenAI stream completed with empty response',
        agentId,
      } as StreamEvent<TState>
      return
    }

    yield parseResponse<TState>(fullBuffer, schema, agentId)
  } catch (err) {
    yield {
      type: EventType.RUN_ERROR,
      message: `OpenAI stream error: ${(err as Error).message}`,
      agentId,
    } as StreamEvent<TState>
  }
}

function parseResponse<TState extends BaseState>(
  buffer: string,
  schema: ZodType,
  agentId: AgentId,
): StreamEvent<TState> {
  try {
    const parsed = JSON.parse(buffer) as Record<string, unknown>
    const validated = schema.parse(parsed)
    return {
      type: EventType.TOOL_CALL_RESULT,
      toolCallId: '',
      messageId: '',
      content: JSON.stringify(validated),
      agentId,
    } as StreamEvent<TState>
  } catch (err) {
    return {
      type: EventType.RUN_ERROR,
      message: `Response parse/validation failed: ${(err as Error).message}`,
      agentId,
    } as StreamEvent<TState>
  }
}

interface CharResult<TState extends BaseState> {
  state: ParserState
  escapeNext: boolean
  event: StreamEvent<TState> | null
}

function processChar<TState extends BaseState>(
  char: string,
  state: ParserState,
  escapeNext: boolean,
  fullBuffer: string,
  agentId: AgentId,
): CharResult<TState> {
  switch (state) {
    case ParserState.SEARCHING:
      if (fullBuffer.endsWith(CHATBOT_MESSAGE_KEY)) {
        return { state: ParserState.IN_CHATBOT_MESSAGE, escapeNext: false, event: null }
      }
      return { state, escapeNext, event: null }

    case ParserState.IN_CHATBOT_MESSAGE:
      if (escapeNext) {
        return {
          state,
          escapeNext: false,
          event: {
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: '',
            delta: unescapeChar(char),
            agentId,
          } as StreamEvent<TState>,
        }
      } else if (char === '\\') {
        return { state, escapeNext: true, event: null }
      } else if (char === '"') {
        return { state: ParserState.PAST_CHATBOT_MESSAGE, escapeNext: false, event: null }
      } else {
        return {
          state,
          escapeNext,
          event: {
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: '',
            delta: char,
            agentId,
          } as StreamEvent<TState>,
        }
      }

    case ParserState.PAST_CHATBOT_MESSAGE:
      return { state, escapeNext, event: null }
  }
}

/** Converts a JSON escape character to its actual value */
function unescapeChar(char: string): string {
  switch (char) {
    case '"':
      return '"'
    case '\\':
      return '\\'
    case 'n':
      return '\n'
    case 't':
      return '\t'
    case 'r':
      return '\r'
    case '/':
      return '/'
    default:
      // For \uXXXX and unknown escapes, return as-is (the character after the backslash)
      return char
  }
}
