# @genui/a3

[![npm version](https://img.shields.io/npm/v/@genui/a3)](https://www.npmjs.com/package/@genui/a3)
[![license](https://img.shields.io/npm/l/@genui/a3)](https://github.com/generalui/a3/blob/main/LICENSE)

**A TypeScript framework for building multi-agent chat applications.**

Define focused agents.
Register them.
Let A3 route conversations dynamically.
No graphs.
No state machines.

## Feature Highlights

- **Multi-agent orchestration** -- agents route to each other dynamically based on conversation context
- **Shared state** -- a single state object flows across all agents in a session
- **Structured output** -- Zod schemas validate every LLM response at runtime
- **Streaming** -- real-time token streaming via `send({ message, stream: true })` with AG-UI-compatible event types
- **Pluggable session stores** -- swap in-memory, AWS AgentCore, Redis, or your own store
- **Pluggable providers** -- ships with AWS Bedrock, OpenAI, and Anthropic; [build your own](./docs/CUSTOM_PROVIDERS.md) for any LLM
- **TypeScript-native** -- full type safety from agent definitions to response handling
- **Dual ESM/CJS** -- works in any Node.js environment

## Why GenUI A3?

### The problem

Building agent-based chat applications is harder than it should be.
Most teams face the same challenges:

- Coordinating multiple specialized agents in a single conversation
- Managing shared state as users move between agents
- Getting structured, validated responses from LLMs
- Swapping LLM providers without rewriting business logic
- Persisting conversation sessions across requests

Existing frameworks solve pieces of this, this is an alternative approach without the complexity of writing graph definitions or managing complex state machines.

### How A3 solves it

A3 approach: **define agents, register them, and let the framework handle routing.**

Each agent is a focused unit with a clear responsibility.
Agents decide when to hand off to another agent based on conversation context.
The framework manages the flow, state, and session persistence automatically.

There are no graphs to define.
No state machines to maintain.

### How A3 compares

| Capability | GenUI A3 | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| **Setup complexity** | Minimal | Moderate | Moderate | High |
| **Routing model** | Dynamic (agent-driven) | Static graph | Role-based | Conversation-based |
| **State management** | Shared global state | Graph state | Shared memory | Message passing |
| **TypeScript-native** | Yes | Python-first | Python-only | Python-first |
| **Structured output** | Zod schemas | Custom parsers | Pydantic | Custom parsers |
| **Session persistence** | Pluggable stores | Custom | Custom | Custom |

A3 optimizes for **simplicity and speed-to-value**.

## Table of Contents

- [Why GenUI A3?](#why-genui-a3)
- [Quick Start](#quick-start)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Core Concepts](#core-concepts)
  - [Agent](#agent)
  - [AgentRegistry](#agentregistry)
  - [ChatSession](#chatsession)
  - [State](#state)
  - [Output Schemas](#output-schemas)
  - [Routing](#routing)
  - [Session Stores](#session-stores)
  - [Providers](#providers)
  - [Streaming](#streaming)
- [Multi-Agent Example](#multi-agent-example)
- [API Reference](#api-reference)
- [Roadmap](#roadmap)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

## [Quick Start](./docs/QUICK-START-EXAMPLES.md)

Install, define a simple agent, register it, and send a message. All in ~20 lines of code.

See the complete [Quick Start Code Example](./docs/QUICK-START-EXAMPLES.md#quick-start).

## Architecture at a Glance

```text
┌──────────────────────────────────────────────────────────────┐
│                      Your Application                        │
└─────────────────────────┬────────────────────────────────────┘
                          │                          ▲
                .send(message)              ChatResponse
                          │              { responseMessage,
                          │                state, goalAchieved }
                          ▼                          │
┌──────────────────────────────────────────────────────────────┐
│                       ChatSession                            │
│                                                              │
│  1. Load session from store          6. Save updated session │
│  2. Append user message              5. Append bot message   │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ manageFlow({ agent,              │ { responseMessage,
            │   sessionData })                 │   newState,
            │                                  │   nextAgentId }
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                        ChatFlow                              │
│                                                              │
│  Looks up active agent, delegates, checks routing            │
│                                                              │
│  If nextAgent ≠ activeAgent:                                 │
│    ┌──────────────────────────────────────────┐              │
│    │  Recursive call to manageFlow            │              │
│    │  with new agent + updated state          │              │
│    └──────────────────────────────────────────┘              │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ generateResponse            │ { chatbotMessage,
            │   ({ agent, sessionData })       │   newState,
            │                                  │   nextAgentId }
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                      Active Agent                            │
│                                                              │
│  • Builds system prompt (prompt)                             │
│  • Defines output schema (Zod)                               │
│  • Determines next agent (transition)                        │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ prompt + schema                  │ structured JSON
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                       Provider                               │
│             (Bedrock, OpenAI, Anthropic)                     │
│                                                              │
│  • Converts Zod → JSON Schema                                │
│  • Merges message history                                    │
│  • Model fallback on error                                   │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ API request                      │ API response
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                         LLM                                  │
└──────────────────────────────────────────────────────────────┘
```

**How it flows:**

1. Your app calls `session.send(message)` with the user's input
1. **ChatSession** loads session data (history, state) from the configured store and appends the user message
1. **ChatFlow** looks up the active agent and calls `generateResponse`
1. The **Agent** builds a system prompt, defines its Zod output schema, and delegates to the provider
1. The **Provider** sends the request to the LLM and returns structured JSON
1. The **Agent** extracts state updates and a routing decision (`nextAgentId`) from the response
1. If the next agent differs from the active agent, ChatFlow **recursively calls `manageFlow`** with the new agent and updated state
1. **ChatSession** appends the bot message, saves the updated session, and returns a `ChatResponse` to your app

Agents route dynamically.
There is no fixed graph.
Each agent decides whether to continue or hand off based on the conversation.

## Core Concepts

### Agent

An agent is the fundamental building block.
Each agent has a focused responsibility and defines how it generates responses, what structured data it extracts, and when to hand off to another agent.

```typescript
import { z } from 'zod'
import { Agent, BaseState } from '@genui/a3'

interface MyState extends BaseState {
  userName?: string
}

const greetingAgent: Agent<MyState> = {
  // Identity
  id: 'greeting',
  name: 'Greeting Agent',
  description: 'Greets the user and collects their name',

  // Prompt: instructions for the LLM
  prompt: async () => `
    You are a friendly greeting agent.
    Ask the user for their name, then greet them.
    Set goalAchieved to true once you know their name.
  `,

  // Output schema: Zod schema for structured data extraction
  outputSchema: z.object({
    userName: z.string().optional(),
  }),

  // Routing: decide the next agent after each turn
  transition: (state, goalAchieved) => {
    return goalAchieved ? 'next-agent' : 'greeting'
  },
}
```

**Agent properties:**

| Property | Required | Description |
|---|---|---|
| `id` | Yes | Unique identifier for the agent |
| `name` | No | Human-readable display name |
| `description` | Yes | What this agent does (used in agent pool prompts) |
| `prompt` | Yes | System prompt string, or async function returning the system prompt |
| `outputSchema` | Yes | Zod schema defining structured data to extract from LLM responses |
| `provider` | No | Per-agent provider override; falls back to the session-level provider |
| `generateResponse` | No | Custom response generator. Must check `input.stream` and return a `Promise` (blocking) or `AsyncGenerator` (streaming). See [Custom generateResponse](#custom-generateresponse). Defaults to the built-in pipeline |
| `setState` | No | Maps extracted LLM data into the shared state object (defaults to shallow merge) |
| `transition` | No | Routing config: a function `(state, goalAchieved) => AgentId` for deterministic routing, or an `AgentId[]` array for LLM-driven routing |
| `filterHistoryStrategy` | No | Custom function to filter conversation history before sending to the LLM |
| `widgets` | No | Zod schemas defining widgets available to the agent (static record or function) |

### AgentRegistry

A singleton registry where all agents are registered before use.

```typescript
import { AgentRegistry } from '@genui/a3'

const registry = AgentRegistry.getInstance<MyState>()

// Register one or many agents
registry.register(greetingAgent)
registry.register([authAgent, mainAgent, wrapUpAgent])

// Query the registry
registry.has('greeting')           // true
registry.get('greeting')           // Agent object
registry.getAll()                  // All registered agents
registry.getDescriptions()         // { greeting: 'Greets the user...' }
registry.count                     // 4
```

### ChatSession

The primary interface your application uses to interact with A3.
Create a session, send messages, get responses.

```typescript
import { ChatSession, MemorySessionStore } from '@genui/a3'
import { createBedrockProvider } from '@genui/a3-bedrock'

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
})

const session = new ChatSession<MyState>({
  sessionId: 'user-123',
  store: new MemorySessionStore(),     // pluggable persistence
  initialAgentId: 'greeting',
  initialState: { userName: undefined },
  provider,                            // required
})

// Blocking: send a message and get a structured response
const result = await session.send({ message: 'Hello!' })

result.responseMessage   // "Hi there! What's your name?"
result.activeAgentId     // 'greeting'
result.nextAgentId       // 'greeting'
result.state             // { userName: undefined }
result.goalAchieved      // false
result.sessionId         // 'user-123'

// Streaming: send a message and stream the response
for await (const event of session.send({ message: 'Hello!', stream: true })) {
  console.log(event)
}
```

### State

A3 uses a shared global state object that flows across all agents in a session.
Define your state by extending `BaseState`.

```typescript
import { BaseState } from '@genui/a3'

interface AppState extends BaseState {
  userName?: string
  isAuthenticated: boolean
  currentStep: string
}
```

Each agent's `setState` merges its extracted data into this shared state.
When agents switch, the full state carries over.

### Output Schemas

Every agent defines a Zod schema for the structured data it needs to extract from LLM responses.
A3 merges this with base fields (`chatbotMessage`, `goalAchieved`, `redirectToAgent`) and validates the LLM output.

```typescript
// Static schema
const schema = z.object({
  userName: z.string().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
})

// Dynamic schema (based on current session state)
const dynamicSchema = (sessionData) => z.object({
  userName: z.string().describe(`Current: ${sessionData.state.userName ?? 'unknown'}`),
})
```

Schemas serve two purposes:

1. **Instruct the LLM** on what data to extract (field names and descriptions become part of the prompt)
1. **Validate the response** at runtime so your application always receives well-typed data

### Routing

The `transition` property controls how an agent hands off to the next agent.
It supports two modes:

**1. Deterministic (function)** -- Your code decides the next agent after each turn:

```typescript
transition: (state, goalAchieved) => {
  if (goalAchieved) return 'main-menu'
  if (state.failedAttempts > 3) return 'escalation'
  return 'auth'  // stay on current agent
}
```

When `transition` is a function, `redirectToAgent` is **not exposed to the LLM** -- routing is fully code-controlled.

**2. Non-deterministic (array)** -- The LLM decides which agent to hand off to:

```typescript
const agent: Agent<MyState> = {
  id: 'triage',
  description: 'Routes users to the appropriate department',
  transition: ['billing', 'support', 'account'],
  // LLM can redirect to any of these agents via redirectToAgent
  // ...
}
```

When `transition` is an array, the `redirectToAgent` field in the LLM output schema is constrained to those agent IDs.
The LLM chooses based on conversation context.

In both cases, when a transition happens, **ChatFlow recursively invokes the next agent** in the same request.
The user sees a single response, even if multiple agents were involved.

### Session Stores

A3 uses pluggable session stores for persistence.
Any object implementing the `SessionStore` interface works.

```typescript
interface SessionStore<TState extends BaseState> {
  load(sessionId: string): Promise<SessionData<TState> | null>
  save(sessionId: string, data: SessionData<TState>): Promise<void>
  delete?(sessionId: string): Promise<void>
}
```

**Built-in stores:**

| Store | Use case |
|---|---|
| `MemorySessionStore` | Development and testing (sessions lost on restart) |

Custom stores are straightforward to implement for Redis, DynamoDB, PostgreSQL, or any other backend.

### Providers

Providers handle communication with LLM backends.
A3 uses a pluggable `Provider` interface.
Providers are separate packages — see the [Providers documentation](./docs/PROVIDERS.md).

```typescript
import { Provider } from '@genui/a3'
```

The `Provider` interface requires three members:

| Member | Description |
|---|---|
| `sendRequest(request)` | Blocking request that returns a structured JSON response |
| `sendRequestStream(request)` | Streaming request that yields AG-UI compatible events |
| `name` | Human-readable name for logging |

**Built-in providers:**

```typescript
import { createBedrockProvider } from '@genui/a3-bedrock'

const provider = createBedrockProvider({
  models: [
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0',  // primary
    'us.anthropic.claude-haiku-4-5-20251001-v1:0',   // fallback
  ],
  region: 'us-east-1', // optional, defaults to AWS SDK default
})
```

```typescript
import { createOpenAIProvider } from '@genui/a3-openai'

const provider = createOpenAIProvider({
  models: ['gpt-4o', 'gpt-4o-mini'],
  apiKey: process.env.OPENAI_API_KEY, // optional, defaults to OPENAI_API_KEY env var
})
```

```typescript
import { createAnthropicProvider } from '@genui/a3-anthropic'

const provider = createAnthropicProvider({
  models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  apiKey: process.env.ANTHROPIC_API_KEY, // optional, defaults to ANTHROPIC_API_KEY env var
})
```

All three providers support:

- **Model fallback** (primary model fails → falls back to next in list)
- **Blocking and streaming** modes
- **Structured output** via Zod schemas
- **Resilience** — automatic retries with backoff, timeouts, and model fallback ([docs](./docs/RESILIENCE.md))

See the [Providers documentation](./docs/PROVIDERS.md) for full configuration options.
To build a provider for an LLM not listed above, see [Creating a Custom Provider](./docs/CUSTOM_PROVIDERS.md).

**Per-agent provider override:**

Each agent can optionally specify its own `provider` to override the session-level provider:

```typescript
const agent: Agent<MyState> = {
  id: 'premium',
  description: 'Handles premium tier requests using GPT-4o',
  provider: createOpenAIProvider({ models: ['gpt-4o'] }),
  // ...
}
```

### Streaming

A3 supports real-time token streaming via `send({ message, stream: true })`.
Instead of waiting for a complete response, your application receives events as they happen.

```typescript
for await (const event of session.send({ message: 'Hello!', stream: true })) {
  switch (event.type) {
    case 'TextMessageContent':
      process.stdout.write(event.delta) // real-time token output
      break
    case 'AgentTransition':
      console.log(`${event.fromAgentId} → ${event.toAgentId}`)
      break
    case 'RunFinished':
      console.log('Final state:', event.response.state)
      break
    case 'RunError':
      console.error('Error:', event.error)
      break
  }
}
```

**StreamEvent types:**

| Event Type | Key Fields | Description |
|---|---|---|
| `RunStarted` | `runId`, `threadId` | Stream has begun |
| `TextMessageStart` | `messageId` | A new text message is starting |
| `TextMessageContent` | `delta`, `agentId` | A text chunk from the active agent |
| `TextMessageEnd` | `messageId` | Text message complete |
| `ToolCallStart` | `toolCallId`, `toolCallName` | Tool/function call initiated |
| `ToolCallArgs` | `toolCallId`, `delta` | Tool argument chunk |
| `ToolCallEnd` | `toolCallId` | Tool call complete |
| `ToolCallResult` | `data`, `agentId` | Tool execution result with extracted data |
| `AgentTransition` | `fromAgentId`, `toAgentId` | Agent handoff occurred |
| `RunFinished` | `response` | Stream complete with final `ChatResponse` |
| `RunError` | `error`, `agentId` | Error during stream |

### Custom generateResponse

When you provide a custom `generateResponse`, it receives `input.stream` (a boolean) so you can branch on whether the caller requested streaming or blocking.
You **must** return the correct type for the mode:

- **Blocking** (`input.stream === false`): return a `Promise<AgentResponseResult>`
- **Streaming** (`input.stream === true`): return an `AsyncGenerator<StreamEvent, AgentResponseResult>`

`manageFlow()` in `chatFlow.ts` validates the return type at runtime.
If you return a `Promise` when streaming was requested (or vice-versa), you will get a descriptive error:

> Agent "my-agent" returned a Promise from generateResponse, but streaming was requested (input.stream = true).
> Return an AsyncGenerator instead, or check input.stream to branch behavior.

```typescript
import { simpleAgentResponse, simpleAgentResponseStream } from '@genui/a3'

const agent: Agent<MyState> = {
  id: 'custom',
  description: 'A helpful assistant with custom response handling',
  prompt: 'You are a helpful assistant.',
  outputSchema: z.object({ sentiment: z.string() }),
  generateResponse(input) {
    // Custom pre-processing here...

    if (input.stream) {
      return simpleAgentResponseStream(input)
    }
    return simpleAgentResponse(input)
  },
}
```

## [Multi-Agent Example](./docs/QUICK-START-EXAMPLES.md#multi-agent-example)

Three agents routing between each other, demonstrating state flowing across agent boundaries and automatic agent chaining.

See the complete [Multi-Agent Code Example](./docs/QUICK-START-EXAMPLES.md#multi-agent-example).

## API Reference

### Core Exports

| Export | Type | Description |
|---|---|---|
| `ChatSession` | Class | Primary interface for sending messages and managing conversations |
| `AgentRegistry` | Class | Singleton registry for agent registration and lookup |
| `AGUIAgent` | Class | AG-UI protocol integration for standardized agent-to-frontend streaming |
| `simpleAgentResponse` | Function | Default blocking response generator for agents |
| `simpleAgentResponseStream` | Function | Default streaming response generator for agents |
| `getAgentResponse` | Function | Low-level blocking agent response pipeline (prompt, schema, LLM call, validation) |
| `getAgentResponseStream` | Function | Low-level streaming agent response pipeline |
| `manageFlow` | Function | Blocking chat flow orchestration with automatic agent chaining |
| `manageFlowStream` | Function | Streaming variant of `manageFlow` yielding `StreamEvent`s |
| `createFullOutputSchema` | Function | Merges agent schema with base response fields |
| `MemorySessionStore` | Class | In-memory session store for development and testing |

### ChatSession Methods

| Method | Returns | Description |
|---|---|---|
| `send({ message })` | `Promise<ChatResponse<TState>>` | Send a user message and get the agent's response (blocking) |
| `send({ message, stream: true })` | `AsyncGenerator<StreamEvent<TState>>` | Send a message and stream the response as events |
| `getSessionData()` | `Promise<SessionData<TState> \| null>` | Load current session state without sending a message |
| `getOrCreateSessionData()` | `Promise<SessionData<TState>>` | Load session or create with initial values if none exists |
| `upsertSessionData(updates)` | `Promise<void>` | Merge partial updates into the current session |
| `getHistory()` | `Promise<Message[]>` | Retrieve conversation history |
| `clear()` | `Promise<void>` | Delete the session from the store |

### AgentRegistry Methods

| Method | Returns | Description |
|---|---|---|
| `getInstance()` | `AgentRegistry<TState>` | Get the singleton instance |
| `resetInstance()` | `void` | Reset the singleton (for testing) |
| `register(agents)` | `void` | Register one or more agents (throws on duplicate ID) |
| `unregister(id)` | `boolean` | Remove an agent by ID |
| `get(id)` | `Agent<TState> \| undefined` | Look up an agent by ID |
| `getAll()` | `Agent<TState>[]` | Get all registered agents |
| `has(id)` | `boolean` | Check if an agent is registered |
| `getDescriptions()` | `Record<string, string>` | Map of agent IDs to their descriptions |
| `clear()` | `void` | Remove all registered agents (for testing) |
| `count` | `number` | Number of registered agents (getter) |

### ChatResponse Fields

| Field | Type | Description |
|---|---|---|
| `responseMessage` | `string` | The agent's text response to the user |
| `activeAgentId` | `string \| null` | The agent that generated this response |
| `nextAgentId` | `string \| null` | The agent that will handle the next message |
| `state` | `TState` | Updated session state after this turn |
| `goalAchieved` | `boolean` | Whether the agent considers its goal complete |
| `sessionId` | `string` | Session identifier |
| `widgets` | `object \| undefined` | Optional widget data for rich UI rendering |

## Roadmap

- **Tool use** -- agent-invoked tool execution within the response cycle

## Requirements

- Node.js 20.19.0+
- TypeScript 5.9+
- `zod` 4.x (included as a dependency)
- A configured LLM provider (AWS Bedrock, OpenAI, and Anthropic providers included via [`@genui/a3-bedrock`](./docs/PROVIDERS.md))

## Contributing

```bash
# Install dependencies
npm install

# Build
npm run build

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Lint
npm run lint

# Watch mode (build + example)
npm run dev
```

## License

ISC
