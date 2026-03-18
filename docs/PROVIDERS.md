# Providers

LLM provider implementations for the A3 agentic framework.

A3 ships with **AWS Bedrock**, **Anthropic**, and **OpenAI** providers out of the box.
All three support blocking and streaming modes, model fallback, and structured output via Zod schemas.

## Quick Start

### AWS Bedrock

```typescript
import { createBedrockProvider } from '@genui/a3-bedrock'

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
  region: 'us-east-1', // optional, defaults to AWS SDK default
})
```

### Anthropic

```typescript
import { createAnthropicProvider } from '@genui/a3-anthropic'

const provider = createAnthropicProvider({
  models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  apiKey: process.env.ANTHROPIC_API_KEY, // optional, defaults to ANTHROPIC_API_KEY env var
})
```

### OpenAI

```typescript
import { createOpenAIProvider } from '@genui/a3-openai'

const provider = createOpenAIProvider({
  models: ['gpt-4o', 'gpt-4o-mini'],
  apiKey: process.env.OPENAI_API_KEY, // optional, defaults to OPENAI_API_KEY env var
})
```

### Use with A3

```typescript
import { ChatSession, MemorySessionStore } from '@genui/a3'

const session = new ChatSession({
  sessionId: 'user-123',
  store: new MemorySessionStore(),
  initialAgentId: 'greeting',
  initialState: {},
  provider, // any provider from above
})

// Blocking
const response = await session.send({ message: 'Hello!' })

// Streaming
for await (const event of session.send({ message: 'Hello!', stream: true })) {
  console.log(event)
}
```

## Provider Reference

### Bedrock — `createBedrockProvider(config)`

Communicates with AWS Bedrock via the [Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html).

| Option | Type | Required | Description |
|---|---|---|---|
| `models` | `string[]` | Yes | Model IDs in preference order (first = primary, rest = fallbacks) |
| `region` | `string` | No | AWS region. Defaults to AWS SDK default |
| `resilience` | `ResilienceConfig` | No | Retry, backoff, and timeout settings. Uses defaults if omitted |

**Behaviour:**

- Uses **tool-based JSON extraction** (`structuredResponse` tool) for reliable structured output
- **Streaming** yields text deltas in real-time, then emits a validated tool-call result at the end
- **Merges sequential same-role messages** to satisfy Bedrock's alternating-role requirement
- **Prepends an initial user message** (`"Hi"`) so the conversation always starts with a user turn

**Prerequisites:** AWS credentials configured via environment variables, IAM role, or AWS profile — the same setup the AWS SDK expects.

---

### Anthropic — `createAnthropicProvider(config)`

Communicates with the Anthropic Messages API using the [Vercel AI SDK](https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic) (`@ai-sdk/anthropic`) for structured output.

| Option | Type | Required | Description |
|---|---|---|---|
| `models` | `string[]` | Yes | Model IDs in preference order (first = primary, rest = fallbacks) |
| `apiKey` | `string` | No | API key. Defaults to `ANTHROPIC_API_KEY` env var |
| `baseURL` | `string` | No | Custom base URL for the Anthropic API |
| `resilience` | `ResilienceConfig` | No | Retry, backoff, and timeout settings. Uses defaults if omitted |

**Behaviour:**

- Uses the Vercel AI SDK's `Output.object()` for structured output — Zod schema conversion and partial JSON parsing handled internally
- **Streaming** yields text deltas in real-time via partial object tracking, then emits a validated tool-call result at the end
- **Appends a `"Continue"` user message** if the last message has an assistant role, to satisfy the alternating-role requirement

**Prerequisites:** An Anthropic API key, either passed directly or set as `ANTHROPIC_API_KEY`.

---

### OpenAI — `createOpenAIProvider(config)`

Communicates with the OpenAI Chat Completions API using [structured output](https://platform.openai.com/docs/guides/structured-outputs) (`response_format: json_schema`).

| Option | Type | Required | Description |
|---|---|---|---|
| `models` | `string[]` | Yes | Model IDs in preference order (first = primary, rest = fallbacks) |
| `apiKey` | `string` | No | API key. Defaults to `OPENAI_API_KEY` env var |
| `baseURL` | `string` | No | Custom base URL for Azure OpenAI or compatible endpoints |
| `organization` | `string` | No | OpenAI organization ID |
| `resilience` | `ResilienceConfig` | No | Retry, backoff, and timeout settings. Uses defaults if omitted |

**Behaviour:**

- Uses **structured output** (`response_format` with `json_schema`) — no tool calls required
- **Enforces strict schemas** automatically (`additionalProperties: false`, all properties `required`)
- **Streaming** extracts `chatbotMessage` text progressively from the JSON response via a character-level state machine, yielding text deltas in real-time
- Detects **truncated responses** (`finish_reason: length`) and surfaces them as errors

**Prerequisites:** An OpenAI API key, either passed directly or set as `OPENAI_API_KEY`.

## Model Fallback

All providers support automatic model fallback.
List models in order of preference:

```typescript
const provider = createBedrockProvider({
  models: [
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0',  // primary
    'us.anthropic.claude-haiku-4-5-20251001-v1:0',   // fallback
  ],
})
```

If the primary model fails, the provider automatically retries with the next model in the list.
If all models fail, the last error is thrown.

All providers include built-in resilience: automatic retries with exponential backoff, per-request and total timeouts, and model fallback.
See the [Resilience documentation](./RESILIENCE.md) for configuration options and defaults.

## Per-Agent Provider Override

Each agent can override the session-level provider:

```typescript
import { createOpenAIProvider } from '@genui/a3-openai'
import { createBedrockProvider } from '@genui/a3-bedrock'

// Session uses Bedrock by default
const session = new ChatSession({
  provider: createBedrockProvider({ models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'] }),
  // ...
})

// This agent uses OpenAI instead
const premiumAgent = {
  id: 'premium',
  description: 'Handles premium tier requests using GPT-4o',
  provider: createOpenAIProvider({ models: ['gpt-4o'] }),
  // ...
}
```

## Provider Interface

All providers implement the `Provider` interface from `@genui`:

| Member | Description |
|---|---|
| `sendRequest(request)` | Blocking request → `Promise<ProviderResponse>` |
| `sendRequestStream(request)` | Streaming request → `AsyncGenerator<StreamEvent>` |
| `name` | Human-readable name (`'bedrock'`, `'anthropic'`, or `'openai'`) |

To create a custom provider, implement this interface and pass it to `ChatSession` or an individual agent.
See [Creating a Custom Provider](./CUSTOM_PROVIDERS.md) for a step-by-step guide.

## Packages

Each provider is a separate npm package.
Install the one(s) you need:

```bash
npm install @genui/a3-bedrock @genui/a3
npm install @genui/a3-openai @genui/a3
npm install @genui/a3-anthropic @genui/a3
```

| Package | Export | Description |
|---|---|---|
| `@genui/a3-bedrock` | `createBedrockProvider` | Factory function returning a Bedrock `Provider` |
| `@genui/a3-bedrock` | `BedrockProviderConfig` | TypeScript config interface |
| `@genui/a3-anthropic` | `createAnthropicProvider` | Factory function returning an Anthropic `Provider` |
| `@genui/a3-anthropic` | `AnthropicProviderConfig` | TypeScript config interface |
| `@genui/a3-openai` | `createOpenAIProvider` | Factory function returning an OpenAI `Provider` |
| `@genui/a3-openai` | `OpenAIProviderConfig` | TypeScript config interface |

## Requirements

- Node.js 20.19.0+
- TypeScript 5.9+
- `@genui/a3` (peer dependency)
- **Bedrock**: AWS credentials configured in the environment
- **Anthropic**: `ANTHROPIC_API_KEY` environment variable or `apiKey` config option
- **OpenAI**: `OPENAI_API_KEY` environment variable or `apiKey` config option
