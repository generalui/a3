# @genui-a3/providers

[![npm version](https://img.shields.io/npm/v/@genui-a3/providers)](https://www.npmjs.com/package/@genui-a3/providers)
[![license](https://img.shields.io/npm/l/@genui-a3/providers)](https://github.com/generalui/a3/blob/main/LICENSE)

**LLM provider implementations for the [A3 agentic framework](https://www.npmjs.com/package/@genui-a3/core).**

Ships with **AWS Bedrock**, **Anthropic** and **OpenAI** providers out of the box.
Both support blocking and streaming modes, model fallback, and structured output via Zod schemas.

## Install

```bash
npm install @genui-a3/providers @genui-a3/core
```

`@genui-a3/core` is a **peer dependency** — it must be installed alongside this package.

## Quick Start

### AWS Bedrock

```typescript
import { createBedrockProvider } from '@genui-a3/providers/bedrock'

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
  region: 'us-east-1', // optional, defaults to AWS SDK default
})
```

### OpenAI

```typescript
import { createOpenAIProvider } from '@genui-a3/providers/openai'

const provider = createOpenAIProvider({
  models: ['gpt-4o', 'gpt-4o-mini'],
  apiKey: process.env.OPENAI_API_KEY, // optional, defaults to OPENAI_API_KEY env var
})
```

### Use with A3

```typescript
import { ChatSession, MemorySessionStore } from '@genui-a3/core'

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

## Providers

### Bedrock — `createBedrockProvider(config)`

Communicates with AWS Bedrock via the [Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html).

| Option | Type | Required | Description |
|---|---|---|---|
| `models` | `string[]` | Yes | Model IDs in preference order (first = primary, rest = fallbacks) |
| `region` | `string` | No | AWS region. Defaults to AWS SDK default |

**Behaviour:**

- Uses **tool-based JSON extraction** (`structuredResponse` tool) for reliable structured output
- **Streaming** yields text deltas in real-time, then emits a validated tool-call result at the end
- **Merges sequential same-role messages** to satisfy Bedrock's alternating-role requirement
- **Prepends an initial user message** (`"Hi"`) so the conversation always starts with a user turn

**Prerequisites:** AWS credentials configured via environment variables, IAM role, or AWS profile — the same setup the AWS SDK expects.

---

### OpenAI — `createOpenAIProvider(config)`

Communicates with the OpenAI Chat Completions API using [structured output](https://platform.openai.com/docs/guides/structured-outputs) (`response_format: json_schema`).

| Option | Type | Required | Description |
|---|---|---|---|
| `models` | `string[]` | Yes | Model IDs in preference order (first = primary, rest = fallbacks) |
| `apiKey` | `string` | No | API key. Defaults to `OPENAI_API_KEY` env var |
| `baseURL` | `string` | No | Custom base URL for Azure OpenAI or compatible endpoints |
| `organization` | `string` | No | OpenAI organization ID |

**Behaviour:**

- Uses **structured output** (`response_format` with `json_schema`) — no tool calls required
- **Enforces strict schemas** automatically (`additionalProperties: false`, all properties `required`)
- **Streaming** extracts `chatbotMessage` text progressively from the JSON response via a character-level state machine, yielding text deltas in real-time
- Detects **truncated responses** (`finish_reason: length`) and surfaces them as errors

**Prerequisites:** An OpenAI API key, either passed directly or set as `OPENAI_API_KEY`.

## Model Fallback

Both providers support automatic model fallback. List models in order of preference:

```typescript
const provider = createBedrockProvider({
  models: [
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0',  // primary
    'us.anthropic.claude-haiku-4-5-20251001-v1:0',   // fallback
  ],
})
```

If the primary model fails, the provider automatically retries with the next model in the list. If all models fail, the last error is thrown.

## Per-Agent Provider Override

Each agent can override the session-level provider:

```typescript
import { createOpenAIProvider } from '@genui-a3/providers/openai'
import { createBedrockProvider } from '@genui-a3/providers/bedrock'

// Session uses Bedrock by default
const session = new ChatSession({
  provider: createBedrockProvider({ models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'] }),
  // ...
})

// This agent uses OpenAI instead
const premiumAgent = {
  id: 'premium',
  provider: createOpenAIProvider({ models: ['gpt-4o'] }),
  // ...
}
```

## Provider Interface

Both providers implement the `Provider` interface from `@genui-a3/core`:

| Member | Description |
|---|---|
| `sendRequest(request)` | Blocking request → `Promise<ProviderResponse>` |
| `sendRequestStream(request)` | Streaming request → `AsyncGenerator<StreamEvent>` |
| `name` | Human-readable name (`'bedrock'` or `'openai'`) |

To create a custom provider, implement this interface and pass it to `ChatSession` or an individual agent.
See [Creating a Custom Provider](./CUSTOM_PROVIDERS.md) for a step-by-step guide to building your own.

## Exports

This package uses [subpath exports](https://nodejs.org/api/packages.html#subpath-exports). Import from the specific provider entry point:

```typescript
// ✅ Correct
import { createBedrockProvider } from '@genui-a3/providers/bedrock'
import { createOpenAIProvider } from '@genui-a3/providers/openai'

// ❌ No bare import
import { ... } from '@genui-a3/providers'
```

| Entry point | Export | Description |
|---|---|---|
| `@genui-a3/providers/bedrock` | `createBedrockProvider` | Factory function returning a Bedrock `Provider` |
| `@genui-a3/providers/bedrock` | `BedrockProviderConfig` | TypeScript config interface |
| `@genui-a3/providers/openai` | `createOpenAIProvider` | Factory function returning an OpenAI `Provider` |
| `@genui-a3/providers/openai` | `OpenAIProviderConfig` | TypeScript config interface |

## Requirements

- Node.js 20.19.0+
- TypeScript 5.9+
- `@genui-a3/core` ≥ 0.1.5 (peer dependency)
- **Bedrock**: AWS credentials configured in the environment
- **OpenAI**: `OPENAI_API_KEY` environment variable or `apiKey` config option

## License

ISC
