# @genui/a3-anthropic

Anthropic provider for the [A3 agentic framework](https://www.npmjs.com/package/@genui/a3).

## Install

```bash
npm install @genui/a3-anthropic @genui/a3
```

## Usage

```typescript
import { createAnthropicProvider } from '@genui/a3-anthropic'

const provider = createAnthropicProvider({
  models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
})
```

## Documentation

See the full [Providers documentation](https://github.com/generalui/a3/blob/main/docs/PROVIDERS.md).
