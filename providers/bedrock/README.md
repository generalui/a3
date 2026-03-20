# @genui/a3-bedrock

AWS Bedrock provider for the [A3 agentic framework](https://www.npmjs.com/package/@genui/a3).

## Install

```bash
npm install @genui/a3-bedrock @genui/a3
```

## Quick Start

```typescript
import { createBedrockProvider } from '@genui/a3-bedrock'

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
  region: 'us-east-1', // optional, defaults to AWS SDK default
})
```

## Configuration

`createBedrockProvider(config)` communicates with AWS Bedrock via the [Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html).

| Option | Type | Required | Description |
|---|---|---|---|
| `models` | `string[]` | Yes | Model IDs in preference order (first = primary, rest = fallbacks) |
| `region` | `string` | No | AWS region. Defaults to AWS SDK default |
| `resilience` | `ResilienceConfig` | No | Retry, backoff, and timeout settings. Uses defaults if omitted |

## Behaviour

- Uses **tool-based JSON extraction** (`structuredResponse` tool) for reliable structured output
- **Streaming** yields text deltas in real-time, then emits a validated tool-call result at the end
- **Merges sequential same-role messages** to satisfy Bedrock's alternating-role requirement
- **Prepends an initial user message** (`"Hi"`) so the conversation always starts with a user turn

## Prerequisites

AWS credentials configured via environment variables, IAM role, or AWS profile — the same setup the AWS SDK expects.

## Documentation

See the [Providers documentation](https://github.com/generalui/a3/blob/main/docs/PROVIDERS.md) for model fallback, per-agent overrides, the provider interface, and more.
