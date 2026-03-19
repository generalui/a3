# @genui/a3

[![npm version](https://img.shields.io/npm/v/@genui-a3/a3)](https://www.npmjs.com/package/@genui-a3/a3)
[![license](https://img.shields.io/npm/l/@genui-a3/a3)](https://github.com/generalui/a3/blob/main/LICENSE)

**Predictable, governable multi-agent orchestration for TypeScript.**

Production agentic systems need more than prompt chains: They need
deterministic guardrails, structured output, and routing you can reason about.

A3 combines flexible LLM reasoning with hard-coded control:
Zod-validated responses, deterministic or LLM-driven routing, and shared typed state.
No graphs. No state machines. Just agents and code.

## Feature Highlights

- **Deterministic + LLM-driven routing** -- code-controlled transitions or let the LLM pick from a bounded set
- **Structured output** -- Zod schemas validate every LLM response at runtime
- **Multi-agent orchestration** -- agents hand off to each other with shared typed state
- **Streaming** -- real-time token streaming with AG-UI-compatible events
- **Pluggable providers** -- Bedrock, OpenAI, Anthropic; or [build your own](./docs/CUSTOM_PROVIDERS.md)
- **Pluggable session stores** -- swap in-memory, Redis, or your own persistence
- **TypeScript-native** -- full type safety from agent definitions to response handling
- **Dual ESM/CJS** -- works in any Node.js environment

## Why A3?

Most agentic frameworks optimize for demos, not production.
Prompt-only agents break when inputs drift.
Graph-based orchestration becomes unmaintainable at scale.
None of them give you compile-time safety or runtime validation out of the box.

A3's approach: **define agents, register them, and let the framework handle routing —
with guardrails at every layer.**

- **Every response validated:** Zod schemas enforce structure at runtime, not just in types
- **Routing you can reason about:** deterministic transitions via code, or bounded LLM-driven selection
- **Typed shared state:** one state object flows across agents with full TypeScript safety
- **Swap providers, not code:** Bedrock, OpenAI, Anthropic; switch with one line

## Quick Start

Scaffold a new project:

```bash
# Fastest way to start — scaffolds a full Next.js app
npx @genui/a3-create@latest my-app
cd my-app
```

Or add A3 to an existing project:

```bash
npm install @genui/a3 @genui/a3-bedrock zod
```

```typescript
import { z } from 'zod'
import { Agent, AgentRegistry, BaseState, ChatSession, MemorySessionStore } from '@genui/a3'
import { createBedrockProvider } from '@genui/a3-bedrock'

interface MyState extends BaseState { userName?: string }

const agent: Agent<MyState> = {
  id: 'greeter',
  description: 'Greets the user and collects their name',
  prompt: 'You are a friendly greeting agent. Ask for the user\'s name.',
  outputSchema: z.object({ userName: z.string().optional() }),
}

AgentRegistry.getInstance<MyState>().register(agent)

const session = new ChatSession<MyState>({
  sessionId: 'demo',
  store: new MemorySessionStore(),
  initialAgentId: 'greeter',
  initialState: { userName: undefined },
  provider: createBedrockProvider({ models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'] }),
})

const result = await session.send({ message: 'Hello!' })
console.log(result.responseMessage)
```

See more examples in the [Quick Start & Examples guide](./docs/QUICK-START-EXAMPLES.md).

## Documentation

- [Core Concepts](./docs/CORE-CONCEPTS.md) -- agents, routing, state, schemas, streaming, providers, stores
- [Architecture](./docs/ARCHITECTURE.md) -- system diagram and request flow
- [API Reference](./docs/API-REFERENCE.md) -- exports, methods, and response fields
- [Quick Start & Examples](./docs/QUICK-START-EXAMPLES.md) -- single-agent and multi-agent walkthroughs
- [Providers](./docs/PROVIDERS.md) -- configuring Bedrock, OpenAI, and Anthropic
- [Custom Providers](./docs/CUSTOM_PROVIDERS.md) -- building your own provider
- [Resilience](./docs/RESILIENCE.md) -- retries, timeouts, and model fallback
- [Custom Logging](./docs/CUSTOM_LOGGING.md) -- plugging in your own logger

## Roadmap

- **Tool use** -- agent-invoked tool execution within the response cycle

## Requirements

- Node.js 20.19.0+
- TypeScript 5.9+
- `zod` 4.x (included as a dependency)
- A configured LLM provider ([Bedrock, OpenAI, or Anthropic](./docs/PROVIDERS.md))

## Contributing

```bash
npm install          # Install dependencies
npm run build        # Build
npm run test:unit    # Run unit tests
npm run lint         # Lint
```

## License

MIT
