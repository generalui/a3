# @genui/a3-openai

OpenAI provider for the [A3 agentic framework](https://www.npmjs.com/package/@genui/a3).

## Install

```bash
npm install @genui/a3-openai @genui/a3
```

## Quick Start

```typescript
import { createOpenAIProvider } from '@genui/a3-openai'

const provider = createOpenAIProvider({
  models: ['gpt-4o', 'gpt-4o-mini'],
  apiKey: process.env.OPENAI_API_KEY, // optional, defaults to OPENAI_API_KEY env var
})
```

## Configuration

`createOpenAIProvider(config)` communicates with the OpenAI Chat Completions API using [structured output](https://platform.openai.com/docs/guides/structured-outputs) (`response_format: json_schema`).

| Option | Type | Required | Description |
|---|---|---|---|
| `models` | `string[]` | Yes | Model IDs in preference order (first = primary, rest = fallbacks) |
| `apiKey` | `string` | No | API key. Defaults to `OPENAI_API_KEY` env var |
| `baseURL` | `string` | No | Custom base URL for Azure OpenAI or compatible endpoints |
| `organization` | `string` | No | OpenAI organization ID |
| `resilience` | `ResilienceConfig` | No | Retry, backoff, and timeout settings. Uses defaults if omitted |

## Behaviour

- Uses **structured output** (`response_format` with `json_schema`) — no tool calls required
- **Enforces strict schemas** automatically (`additionalProperties: false`, all properties `required`)
- **Streaming** extracts `chatbotMessage` text progressively from the JSON response via a character-level state machine, yielding text deltas in real-time
- Detects **truncated responses** (`finish_reason: length`) and surfaces them as errors

## Prerequisites

An OpenAI API key, either passed directly or set as `OPENAI_API_KEY`.

## Documentation

See the [Providers documentation](https://github.com/generalui/a3/blob/main/docs/PROVIDERS.md) for model fallback, per-agent overrides, the provider interface, and more.
