# @genui/a3-bedrock

AWS Bedrock provider for the [A3 agentic framework](https://www.npmjs.com/package/@genui/a3).

## Install

```bash
npm install @genui/a3-bedrock @genui/a3
```

## Usage

```typescript
import { createBedrockProvider } from '@genui/a3-bedrock'

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
  region: 'us-east-1',
})
```

## Documentation

See the full [Providers documentation](https://github.com/generalui/a3/blob/main/docs/PROVIDERS.md).
