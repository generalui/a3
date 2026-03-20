# @genui/a3-anthropic

Anthropic provider for the [A3 agentic framework](https://www.npmjs.com/package/@genui/a3).

## Install

```bash
npm install @genui/a3-anthropic @genui/a3
```

## Quick Start

```typescript
import { createAnthropicProvider } from '@genui/a3-anthropic'

const provider = createAnthropicProvider({
  models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  apiKey: process.env.ANTHROPIC_API_KEY, // optional, defaults to ANTHROPIC_API_KEY env var
})
```

## Configuration

`createAnthropicProvider(config)` communicates with the Anthropic Messages API using the [Vercel AI SDK](https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic) (`@ai-sdk/anthropic`) for structured output.

| Option | Type | Required | Description |
|---|---|---|---|
| `models` | `string[]` | Yes | Model IDs in preference order (first = primary, rest = fallbacks) |
| `apiKey` | `string` | No | API key. Defaults to `ANTHROPIC_API_KEY` env var |
| `baseURL` | `string` | No | Custom base URL for the Anthropic API |
| `resilience` | `ResilienceConfig` | No | Retry, backoff, and timeout settings. Uses defaults if omitted |

## Behaviour

- Uses the Vercel AI SDK's `Output.object()` for structured output — Zod schema conversion and partial JSON parsing handled internally
- **Streaming** yields text deltas in real-time via partial object tracking, then emits a validated tool-call result at the end
- **Appends a `"Continue"` user message** if the last message has an assistant role, to satisfy the alternating-role requirement

## Prerequisites

An Anthropic API key, either passed directly or set as `ANTHROPIC_API_KEY`.

## Documentation

See the [Providers documentation](https://github.com/generalui/a3/blob/main/docs/PROVIDERS.md) for model fallback, per-agent overrides, the provider interface, and more.
