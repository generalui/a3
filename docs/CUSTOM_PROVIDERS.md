# Creating a Custom Provider

This guide walks you through building an A3 provider for any LLM that isn't covered by the built-in Bedrock, OpenAI, or Anthropic packages.
By the end you'll have a working `Provider` implementation with both blocking and streaming support.

## When to Create a Custom Provider

Create a custom provider when you need to connect A3 to an LLM that doesn't have a built-in provider package — for example Google Gemini, Cohere, Mistral, or a locally-hosted model.

A provider is a thin adapter.
Its job is to:

1. Convert A3's provider-agnostic request format into your LLM's API format
1. Send the request
1. Convert the response back into A3's expected format (JSON string for blocking, AG-UI events for streaming)

## The Provider Interface

Every provider implements the `Provider` interface from `@genui-a3/core`:

```typescript
import { ZodType } from 'zod'

interface Provider {
  /** Blocking request that returns a structured JSON response */
  sendRequest(request: ProviderRequest): Promise<ProviderResponse>

  /** Streaming request that yields AG-UI compatible events */
  sendRequestStream<TState extends BaseState = BaseState>(
    request: ProviderRequest,
  ): AsyncIterable<StreamEvent<TState>>

  /** Human-readable name for logging */
  readonly name: string
}
```

| Member | Description |
|---|---|
| `sendRequest(request)` | Blocking call. Returns a `Promise<ProviderResponse>` containing the full JSON response. |
| `sendRequestStream(request)` | Streaming call. Returns an `AsyncIterable` (typically an `AsyncGenerator`) of AG-UI `StreamEvent`s. |
| `name` | A human-readable string used in log messages (e.g. `'gemini'`, `'mistral'`). |

## What Your Provider Receives

Both methods receive a `ProviderRequest`:

```typescript
interface ProviderRequest {
  /** System prompt including agent instructions */
  systemPrompt: string
  /** Conversation messages */
  messages: ProviderMessage[]
  /** Zod schema for structured response validation */
  responseSchema: ZodType
}

interface ProviderMessage {
  role: 'user' | 'assistant'
  content: string
}
```

| Field | Description |
|---|---|
| `systemPrompt` | The full system prompt, including the agent's instructions, base prompt, and transition context. Pass this as the system message to your LLM. |
| `messages` | Conversation history in chronological order. Already converted to simple `{ role, content }` pairs. |
| `responseSchema` | A Zod schema describing the exact JSON structure the LLM must return. Use this for validation and to generate a JSON schema for the LLM. |

### The Output Schema Structure

The `responseSchema` is a Zod object that always includes these base fields, merged with the agent's custom `outputSchema`:

| Field | Type | Description |
|---|---|---|
| `chatbotMessage` | `string` | The agent's text response to the user (streamed in real-time) |
| `goalAchieved` | `boolean` | Whether the agent considers its goal complete |
| `redirectToAgent` | `string \| null` | Next agent ID for LLM-driven transitions, or `null` to stay |
| `conversationPayload` | `object` | Agent-specific structured data (defined by the agent's `outputSchema`) |
| `widgets` | `object \| undefined` | Optional widget data for UI rendering |

The LLM must return valid JSON matching this schema.
The `chatbotMessage` field is the text that gets streamed to the user in real-time during streaming mode.

## Implementing `sendRequest` (Blocking)

The blocking path is straightforward: call the LLM, get JSON back, validate it.

### Step-by-Step

1. **Convert the Zod schema to JSON Schema** — call `responseSchema.toJSONSchema()` (Zod v4) to get a plain JSON schema object your LLM can understand
1. **Format and send the request** — convert messages to your LLM's format and call its API
1. **Extract the JSON response** — parse the LLM's output to get a JSON object
1. **Return a `ProviderResponse`** — wrap the JSON string with optional usage info

```typescript
interface ProviderResponse {
  /** JSON string matching the response schema */
  content: string
  /** Optional token usage information */
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}
```

### Example

```typescript
async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
  // 1. Convert Zod schema to JSON Schema
  const jsonSchema = request.responseSchema.toJSONSchema()

  // 2. Call your LLM
  const response = await myLLM.chat({
    system: request.systemPrompt,
    messages: request.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    responseFormat: { type: 'json_schema', schema: jsonSchema },
  })

  // 3. Validate the response (throws ZodError if invalid)
  const validated = request.responseSchema.parse(JSON.parse(response.text))

  // 4. Return ProviderResponse
  return {
    content: JSON.stringify(validated),
    usage: {
      inputTokens: response.usage?.input,
      outputTokens: response.usage?.output,
      totalTokens: response.usage?.total,
    },
  }
}
```

## Implementing `sendRequestStream` (Streaming)

Streaming is where most of the complexity lives.
Your provider must yield AG-UI events that the A3 framework consumes.

### Events Your Provider Yields

Your provider is only responsible for yielding **three** event types:

| Event | When | Purpose |
|---|---|---|
| `TEXT_MESSAGE_CONTENT` | Each time new text is available | Delivers text deltas to the UI in real-time |
| `TOOL_CALL_RESULT` | Stream completes successfully | Delivers the full, validated JSON response |
| `RUN_ERROR` | Any error occurs | Reports the error — **never throw from a stream** |

### Events the Framework Handles

The framework (`simpleAgentResponseStream` in `src/core/agent.ts`) wraps your events with lifecycle events automatically.
Do **not** yield these yourself:

- `TEXT_MESSAGE_START` / `TEXT_MESSAGE_END` — opened/closed around your `TEXT_MESSAGE_CONTENT` events
- `RUN_STARTED` / `RUN_FINISHED` — emitted by `chatFlow.ts` and `AGUIAgent.ts`

### Text Delta Extraction

During streaming, the LLM progressively builds a JSON object.
Your job is to track the `chatbotMessage` field's growth and yield only the **new** characters as deltas.

The pattern used by all built-in providers:

```typescript
function extractDelta(
  partial: Record<string, unknown>,
  prevLength: number,
): string | null {
  const chatbotMessage = partial.chatbotMessage
  if (typeof chatbotMessage !== 'string' || chatbotMessage.length <= prevLength) {
    return null
  }
  return chatbotMessage.slice(prevLength)
}
```

Use it in your stream loop:

```typescript
let prevMessageLength = 0

for await (const partial of partialObjects) {
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
```

### Approach 1: Vercel AI SDK (Recommended)

If your LLM has a [Vercel AI SDK provider](https://sdk.vercel.ai/providers) (e.g. `@ai-sdk/google`, `@ai-sdk/mistral`), this is the easiest path.
The AI SDK handles partial JSON parsing, schema conversion, and streaming internally.

The pattern (used by the OpenAI and Anthropic providers):

```typescript
import { streamText, Output, jsonSchema } from 'ai'
import { createMyLLM } from '@ai-sdk/my-llm' // hypothetical
import { EventType } from '@ag-ui/client'
import type { StreamEvent, BaseState } from '@genui-a3/core'

async *sendRequestStream<TState extends BaseState>(
  request: ProviderRequest,
): AsyncGenerator<StreamEvent<TState>> {
  const myLLM = createMyLLM({ apiKey: '...' })

  // Start the stream with structured output
  const result = streamText({
    model: myLLM('my-model'),
    system: request.systemPrompt,
    messages: request.messages,
    output: Output.object({ schema: toJsonSchema(request.responseSchema) }),
  })

  // Iterate over partial objects
  let prevMessageLength = 0
  for await (const partial of result.partialOutputStream) {
    const obj = partial as Record<string, unknown>
    const delta = extractDelta(obj, prevMessageLength)
    if (delta) {
      prevMessageLength += delta.length
      yield {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: '',
        delta,
        agentId: 'my-provider',
      } as StreamEvent<TState>
    }
  }

  // Validate and yield the final result
  const finalObject = await result.output
  if (finalObject === null) {
    yield {
      type: EventType.RUN_ERROR,
      message: 'Stream completed with null output',
      agentId: 'my-provider',
    } as StreamEvent<TState>
    return
  }

  const validated = request.responseSchema.parse(finalObject)
  yield {
    type: EventType.TOOL_CALL_RESULT,
    toolCallId: '',
    messageId: '',
    content: JSON.stringify(validated),
    agentId: 'my-provider',
  } as StreamEvent<TState>
}
```

### Approach 2: Raw SDK

If no Vercel AI SDK adapter exists for your LLM, work directly with the LLM's native streaming API.
You'll need to:

1. Accumulate text chunks and yield them as `TEXT_MESSAGE_CONTENT` deltas
1. Accumulate tool/JSON chunks into a buffer
1. Parse and validate the buffer when the stream ends
1. Yield `TOOL_CALL_RESULT` on success or `RUN_ERROR` on failure

This is the pattern the Bedrock provider uses:

```typescript
async *sendRequestStream<TState extends BaseState>(
  request: ProviderRequest,
): AsyncGenerator<StreamEvent<TState>> {
  const jsonSchema = request.responseSchema.toJSONSchema()

  // Start the raw stream
  const rawStream = await myLLM.streamChat({
    system: request.systemPrompt,
    messages: request.messages,
    responseFormat: { type: 'json_schema', schema: jsonSchema },
  })

  let jsonBuffer = ''

  try {
    for await (const chunk of rawStream) {
      if (chunk.type === 'text') {
        yield {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: '',
          delta: chunk.text,
          agentId: 'my-provider',
        } as StreamEvent<TState>
      } else if (chunk.type === 'json') {
        jsonBuffer += chunk.data
      }
    }

    // Validate the accumulated JSON
    const parsed = JSON.parse(jsonBuffer)
    const validated = request.responseSchema.parse(parsed)

    yield {
      type: EventType.TOOL_CALL_RESULT,
      toolCallId: '',
      messageId: '',
      content: JSON.stringify(validated),
      agentId: 'my-provider',
    } as StreamEvent<TState>
  } catch (err) {
    yield {
      type: EventType.RUN_ERROR,
      message: `Stream error: ${(err as Error).message}`,
      agentId: 'my-provider',
    } as StreamEvent<TState>
  }
}
```

### Error Handling

**Never throw from `sendRequestStream`.** The framework expects the stream to yield a terminal event rather than throw.

- Wrap the entire stream body in `try/catch`
- In the `catch` block, yield a `RUN_ERROR` event
- Always yield exactly one terminal event: either `TOOL_CALL_RESULT` (success) or `RUN_ERROR` (failure)

```typescript
async *sendRequestStream<TState extends BaseState>(
  request: ProviderRequest,
): AsyncGenerator<StreamEvent<TState>> {
  try {
    // ... stream logic ...
  } catch (err) {
    yield {
      type: EventType.RUN_ERROR,
      message: `MyProvider stream error: ${(err as Error).message}`,
      agentId: 'my-provider',
    } as StreamEvent<TState>
  }
}
```

## Model Fallback

A3 provides a shared `executeWithFallback` utility in `providers/utils/`.
It tries each model in order and falls back to the next if one fails.

### Blocking Fallback

```typescript
import { executeWithFallback } from '../utils/executeWithFallback'

async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
  return executeWithFallback(this.models, (model) =>
    this.sendWithModel(model, request),
  )
}
```

### Streaming Fallback (Eager First-Chunk Pattern)

For streaming, you need to detect connection/model errors **before** you start yielding events.
The pattern: start the stream, consume the first chunk (which forces the API call), and only then yield events.

```typescript
// Helper: start stream and consume first chunk to trigger the API call
async function startStream(model: string, request: ProviderRequest) {
  const result = streamText({
    model: myLLM(model),
    system: request.systemPrompt,
    messages: request.messages,
    output: Output.object({ schema: toJsonSchema(request.responseSchema) }),
  })

  const reader = result.partialOutputStream[Symbol.asyncIterator]()
  const first = await reader.next() // Forces the API call — throws on connection error

  return { result, reader, first }
}

// In sendRequestStream:
async *sendRequestStream<TState extends BaseState>(
  request: ProviderRequest,
): AsyncGenerator<StreamEvent<TState>> {
  // Fallback happens here — if primary model fails on first chunk, retry with next
  const { result, reader, first } = await executeWithFallback(
    this.models,
    (model) => startStream(model, request),
  )

  // Process the stream (first chunk already consumed)
  yield* processMyStream<TState>(result, reader, first, 'my-provider', request.responseSchema)
}
```

This is the exact pattern used by the OpenAI and Anthropic providers.

## Complete Example

A full, copy-pasteable provider factory for a hypothetical LLM:

```typescript
import { EventType } from '@ag-ui/client'
import type {
  Provider,
  ProviderRequest,
  ProviderResponse,
  BaseState,
  StreamEvent,
} from '@genui-a3/core'
import { executeWithFallback } from '@genui-a3/providers/utils'

// --- Hypothetical LLM SDK ---
import { MyLLMClient } from 'my-llm-sdk'

export interface MyProviderConfig {
  apiKey: string
  models: string[]
}

/**
 * Extracts the new portion of chatbotMessage from a partial object.
 */
function extractDelta(
  partial: Record<string, unknown>,
  prevLength: number,
): string | null {
  const chatbotMessage = partial.chatbotMessage
  if (typeof chatbotMessage !== 'string' || chatbotMessage.length <= prevLength) {
    return null
  }
  return chatbotMessage.slice(prevLength)
}

export function createMyProvider(config: MyProviderConfig): Provider {
  const client = new MyLLMClient({ apiKey: config.apiKey })
  const models = config.models

  return {
    name: 'my-provider',

    async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
      const jsonSchema = request.responseSchema.toJSONSchema()

      return executeWithFallback(models, async (model) => {
        const response = await client.chat({
          model,
          system: request.systemPrompt,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          responseFormat: { type: 'json_schema', schema: jsonSchema },
        })

        // Validate before returning
        const validated = request.responseSchema.parse(JSON.parse(response.text))

        return {
          content: JSON.stringify(validated),
          usage: {
            inputTokens: response.usage?.inputTokens,
            outputTokens: response.usage?.outputTokens,
            totalTokens: (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0),
          },
        }
      })
    },

    async *sendRequestStream<TState extends BaseState = BaseState>(
      request: ProviderRequest,
    ): AsyncGenerator<StreamEvent<TState>> {
      const jsonSchema = request.responseSchema.toJSONSchema()
      const agentId = 'my-provider'

      try {
        // Use fallback for the connection phase
        const rawStream = await executeWithFallback(models, (model) =>
          client.streamChat({
            model,
            system: request.systemPrompt,
            messages: request.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            responseFormat: { type: 'json_schema', schema: jsonSchema },
          }),
        )

        let prevMessageLength = 0
        let fullJson = ''

        for await (const chunk of rawStream) {
          // Yield text deltas for real-time display
          if (chunk.type === 'text') {
            yield {
              type: EventType.TEXT_MESSAGE_CONTENT,
              messageId: '',
              delta: chunk.text,
              agentId,
            } as StreamEvent<TState>
          }

          // Accumulate JSON for final validation
          if (chunk.type === 'partial_json') {
            const partial = chunk.data as Record<string, unknown>
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
            fullJson = JSON.stringify(partial)
          }
        }

        // Validate the final object
        const parsed = JSON.parse(fullJson)
        const validated = request.responseSchema.parse(parsed)

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
          message: `my-provider stream error: ${(err as Error).message}`,
          agentId,
        } as StreamEvent<TState>
      }
    },
  }
}
```

### Using Your Provider

```typescript
import { ChatSession, MemorySessionStore } from '@genui-a3/core'
import { createMyProvider } from './myProvider'

const provider = createMyProvider({
  apiKey: process.env.MY_LLM_API_KEY!,
  models: ['my-model-large', 'my-model-small'],
})

const session = new ChatSession({
  sessionId: 'user-123',
  store: new MemorySessionStore(),
  initialAgentId: 'greeting',
  provider,
})

// Blocking
const response = await session.send({ message: 'Hello!' })

// Streaming
for await (const event of session.send({ message: 'Hello!', stream: true })) {
  if (event.type === 'TEXT_MESSAGE_CONTENT') {
    process.stdout.write(event.delta)
  }
}
```

## Gotchas and Tips

### Message Ordering

Some LLMs require messages to start with a user turn or alternate strictly between roles.
The Bedrock provider handles this by prepending a `"Hi"` user message and merging consecutive same-role messages.
Check your LLM's requirements and preprocess accordingly.

### `messageId` and `toolCallId` Assignment

The framework handles these IDs differently depending on the event type:

- **`TEXT_MESSAGE_CONTENT`** — The framework always overwrites `messageId` with its own `crypto.randomUUID()` in `simpleAgentResponseStream`.
Any value you provide (including `''`) is silently ignored.
You can safely pass an empty string here.
- **`TOOL_CALL_RESULT`** — The event is yielded as-is.
The framework does **not** assign or overwrite IDs, so whatever `messageId` and `toolCallId` you set will pass through to downstream consumers.
If you need traceability or correlation on the final result event, supply your own meaningful IDs here.

Providers can supply their own IDs for any event without issue.
For `TOOL_CALL_RESULT` it is particularly useful to do so, since those values are preserved end-to-end.

### Schema Enforcement

Different LLMs have different levels of JSON schema support:

- **OpenAI**: Supports `response_format: { type: 'json_schema' }` with strict mode.
Requires `additionalProperties: false` and all properties in `required`.
- **Bedrock**: Uses tool-based extraction (a `structuredResponse` tool with the schema as input).
- **Others**: If your LLM doesn't support structured output natively, include the JSON schema in the system prompt and parse the response yourself.

Always validate with `responseSchema.parse()` regardless of the LLM's schema support — this is your safety net.

### Terminal Events

Every stream must yield exactly **one** terminal event:

- `TOOL_CALL_RESULT` on success (contains the full validated JSON)
- `RUN_ERROR` on failure

If a stream ends without either, the framework throws `'Stream completed without tool call data'`.

### Testing Your Provider

1. **Unit test `sendRequest`**: Mock your LLM SDK, verify the returned `content` parses as valid JSON matching the schema
1. **Unit test `sendRequestStream`**: Collect all yielded events, verify you get `TEXT_MESSAGE_CONTENT` events followed by exactly one `TOOL_CALL_RESULT`
1. **Integration test**: Wire your provider into a `ChatSession` and send a real message through the full flow
1. **Error paths**: Verify that API errors, invalid JSON, and schema validation failures all produce `RUN_ERROR` events (not thrown exceptions)

## Reference

| File | Description |
|---|---|
| `src/types/provider.ts` | `Provider`, `ProviderRequest`, `ProviderResponse` interfaces |
| `src/types/stream.ts` | `StreamEvent` type union (all AG-UI event types) |
| `src/core/schemas.ts` | `createFullOutputSchema` — how the output schema is built |
| `src/core/agent.ts` | `simpleAgentResponseStream` — how the framework consumes provider events |
| `providers/openai/streamProcessor.ts` | AI SDK streaming pattern (cleanest reference) |
| `providers/bedrock/streamProcessor.ts` | Raw SDK streaming pattern |
| `providers/utils/executeWithFallback.ts` | Shared model fallback utility |
