# Providers

LLM provider implementations for the A3 agentic framework.

A provider is a thin adapter that connects A3 to an LLM API.
Its job is to convert A3's provider-agnostic request format into the LLM's API format, send the request, and convert the response back into A3's expected format (JSON string for blocking, AG-UI events for streaming).

A3 ships with **AWS Bedrock**, **Anthropic**, and **OpenAI** providers out of the box.
All three support blocking and streaming modes, model fallback, and structured output via Zod schemas.

For information on specific providers, please see their documentation:

- [AWS Bedrock (`@genui/a3-bedrock`)](https://www.npmjs.com/package/@genui/a3-bedrock)
- [Anthropic (`@genui/a3-anthropic`)](https://www.npmjs.com/package/@genui/a3-anthropic)
- [OpenAI (`@genui/a3-openai`)](https://www.npmjs.com/package/@genui/a3-openai)

To connect A3 to an LLM that isn't covered by the built-in providers, see [Creating a Custom Provider](./CUSTOM_PROVIDERS.md).

## Use with A3

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

All providers implement the `Provider` interface from `@genui/a3`:

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
