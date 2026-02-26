# @genui-a3/core

[![npm version](https://img.shields.io/npm/v/@genui-a3/core)](https://www.npmjs.com/package/@genui-a3/core)
[![license](https://img.shields.io/npm/l/@genui-a3/core)](https://github.com/generalui/a3/blob/main/LICENSE)

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
- **Streaming** -- real-time token streaming via `sendStream` with AG-UI-compatible event types
- **Pluggable session stores** -- swap in-memory, AWS AgentCore, Redis, or your own store
- **Pluggable providers** -- ships with AWS Bedrock; designed for additional providers
- **TypeScript-native** -- full type safety from agent definitions to response handling
- **Dual ESM/CJS** -- works in any Node.js environment

## Table of Contents

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
- [Comparison](#comparison)
- [Roadmap](#roadmap)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

### Install

```bash
npm install @genui-a3/core
```

### Define an agent

```typescript
import { z } from 'zod'
import { Agent, simpleAgentResponse, BaseState } from '@genui-a3/core'

interface State extends BaseState {
  userName?: string
}

export const greetingAgent: Agent<State> = {
  id: 'greeting',
  name: 'Greeting Agent',
  description: 'Greets the user and collects their name',
  promptGenerator: async () => `
    You are a friendly greeting agent. Your goal is to greet the user
    and learn their name. Once you have their name, set goalAchieved to true.
  `,
  outputSchema: z.object({
    userName: z.string().optional(),
  }),
  generateAgentResponse: simpleAgentResponse,
  setState: (data, state) => ({ ...state, ...data }),
  nextAgentSelector: (_state, goalAchieved) =>
    goalAchieved ? 'end' : 'greeting',
}
```

### Register and run

```typescript
import { AgentRegistry, ChatSession, MemorySessionStore } from '@genui-a3/core'

const registry = AgentRegistry.getInstance<State>()
registry.register(greetingAgent)

const session = new ChatSession<State>({
  sessionId: 'demo',
  store: new MemorySessionStore(),
  initialAgentId: 'greeting',
  initialState: { userName: undefined },
})

const response = await session.send('Hi there!')
console.log(response.responseMessage)
// => "Hello! I'd love to get to know you. What's your name?"
```

That's it.
One agent, one session, one function call.

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
            │ generateAgentResponse            │ { chatbotMessage,
            │   ({ agent, sessionData })       │   newState,
            │                                  │   nextAgentId }
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                      Active Agent                            │
│                                                              │
│  • Builds system prompt (promptGenerator)                    │
│  • Defines output schema (Zod)                               │
│  • Determines next agent (nextAgentSelector)                 │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ prompt + schema                  │ structured JSON
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                       Provider                               │
│                      (Bedrock)                               │
│                                                              │
│  • Converts Zod → JSON Schema                               │
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
1. **ChatFlow** looks up the active agent and calls `generateAgentResponse`
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
import { Agent, simpleAgentResponse, BaseState } from '@genui-a3/core'

interface MyState extends BaseState {
  userName?: string
}

const greetingAgent: Agent<MyState> = {
  // Identity
  id: 'greeting',
  name: 'Greeting Agent',
  description: 'Greets the user and collects their name',

  // Prompt: instructions for the LLM
  promptGenerator: async () => `
    You are a friendly greeting agent.
    Ask the user for their name, then greet them.
    Set goalAchieved to true once you know their name.
  `,

  // Output schema: Zod schema for structured data extraction
  outputSchema: z.object({
    userName: z.string().optional(),
  }),

  // Response generator: how to process the LLM response
  generateAgentResponse: simpleAgentResponse,

  // State mapper: merge extracted data into global state
  setState: (data, state) => ({
    ...state,
    ...data,
  }),

  // Routing: decide the next agent after each turn
  nextAgentSelector: (state, goalAchieved) => {
    return goalAchieved ? 'next-agent' : 'greeting'
  },
}
```

**Agent properties:**

| Property | Required | Description |
|---|---|---|
| `id` | Yes | Unique identifier for the agent |
| `name` | Yes | Human-readable display name |
| `description` | Yes | What this agent does (used in agent pool prompts) |
| `promptGenerator` | Yes | Async function returning the system prompt for this agent |
| `outputSchema` | Yes | Zod schema defining structured data to extract from LLM responses |
| `generateAgentResponse` | Yes | Function that orchestrates the full response cycle |
| `setState` | Yes | Maps extracted LLM data into the shared state object |
| `nextAgentSelector` | No | Determines the next agent based on state and goal status |
| `transitionsTo` | No | Array of agent IDs this agent is allowed to redirect to |
| `filterHistoryStrategy` | No | Custom function to filter conversation history before sending to the LLM |
| `modelId` | No | Override the default model for this agent |

### AgentRegistry

A singleton registry where all agents are registered before use.

```typescript
import { AgentRegistry } from '@genui-a3/core'

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
import { ChatSession, MemorySessionStore } from '@genui-a3/core'

const session = new ChatSession<MyState>({
  sessionId: 'user-123',
  store: new MemorySessionStore(),     // pluggable persistence
  initialAgentId: 'greeting',
  initialState: { userName: undefined },
})

// Send a message and get a structured response
const result = await session.send('Hello!')

result.responseMessage   // "Hi there! What's your name?"
result.activeAgentId     // 'greeting'
result.nextAgentId       // 'greeting'
result.state             // { userName: undefined }
result.goalAchieved      // false
result.sessionId         // 'user-123'
```

### State

A3 uses a shared global state object that flows across all agents in a session.
Define your state by extending `BaseState`.

```typescript
import { BaseState } from '@genui-a3/core'

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

Agents route to each other in three ways:

**1. `nextAgentSelector`** -- Choose the next agent programmatically after each turn:

```typescript
nextAgentSelector: (state, goalAchieved) => {
  if (goalAchieved) return 'main-menu'
  if (state.failedAttempts > 3) return 'escalation'
  return 'auth'  // stay on current agent
}
```

**2. `redirectToAgent`** -- The LLM itself can request a redirect via the base response schema.
The agent's prompt and agent pool listing tell the LLM which agents are available.

**3. `transitionsTo`** -- Constrain which agents the LLM can redirect to:

```typescript
const agent: Agent<MyState> = {
  id: 'triage',
  transitionsTo: ['billing', 'support', 'account'],
  // LLM can only redirect to these three agents
  // ...
}
```

When a redirect happens, **ChatFlow recursively invokes the next agent** in the same request.
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
| `AgentCoreMemoryStore` | AWS Bedrock AgentCore integration for persistent storage |

Custom stores are straightforward to implement for Redis, DynamoDB, PostgreSQL, or any other backend.

### Providers

Providers handle communication with LLM backends.
A3 ships with an AWS Bedrock provider and is designed so additional providers can be added.

```typescript
import { sendChatRequest } from '@genui-a3/core'
```

The Bedrock provider:

- Sends structured requests via the AWS Bedrock Converse API
- Uses tool-based JSON extraction for reliable structured output
- Supports model fallback (primary model fails, falls back to secondary)
- Merges sequential same-sender messages for API compatibility
- Applies agent-specific history filtering before sending

### Streaming

A3 supports real-time token streaming via `sendStream`.
Instead of waiting for a complete response, your application receives events as they happen.

```typescript
for await (const event of session.sendStream('Hello!')) {
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

## Multi-Agent Example

Three agents routing between each other, demonstrating state flowing across agent boundaries and automatic agent chaining.

### Define the agents

```typescript
import { z } from 'zod'
import { Agent, simpleAgentResponse, BaseState } from '@genui-a3/core'

interface AppState extends BaseState {
  userName?: string
  isAuthenticated: boolean
  issueCategory?: string
}

// Agent 1: Greeting -- collects the user's name, then routes to auth
const greetingAgent: Agent<AppState> = {
  id: 'greeting',
  name: 'Greeting Agent',
  description: 'Greets the user and collects their name',
  promptGenerator: async () => `
    Greet the user warmly. Ask for their name.
    Once you have it, set goalAchieved to true.
  `,
  outputSchema: z.object({ userName: z.string().optional() }),
  generateAgentResponse: simpleAgentResponse,
  setState: (data, state) => ({ ...state, ...data }),
  nextAgentSelector: (_state, goalAchieved) =>
    goalAchieved ? 'auth' : 'greeting',
  transitionsTo: ['auth'],
}

// Agent 2: Auth -- verifies identity, then routes to support
const authAgent: Agent<AppState> = {
  id: 'auth',
  name: 'Auth Agent',
  description: 'Verifies user identity',
  promptGenerator: async ({ sessionData }) => `
    The user's name is ${sessionData.state.userName}.
    Ask them to confirm their email to verify identity.
    Set goalAchieved to true once verified.
  `,
  outputSchema: z.object({ isAuthenticated: z.boolean() }),
  generateAgentResponse: simpleAgentResponse,
  setState: (data, state) => ({ ...state, ...data }),
  nextAgentSelector: (_state, goalAchieved) =>
    goalAchieved ? 'support' : 'auth',
  transitionsTo: ['support'],
}

// Agent 3: Support -- handles the user's issue
const supportAgent: Agent<AppState> = {
  id: 'support',
  name: 'Support Agent',
  description: 'Helps resolve user issues',
  promptGenerator: async ({ sessionData }) => `
    The user ${sessionData.state.userName} is authenticated.
    Help them with their issue. Categorize it.
    Set goalAchieved when resolved.
  `,
  outputSchema: z.object({
    issueCategory: z.string().optional(),
  }),
  generateAgentResponse: simpleAgentResponse,
  setState: (data, state) => ({ ...state, ...data }),
  nextAgentSelector: (_state, goalAchieved) =>
    goalAchieved ? 'end' : 'support',
}
```

### Wire them up

```typescript
import { AgentRegistry, ChatSession, MemorySessionStore } from '@genui-a3/core'

const registry = AgentRegistry.getInstance<AppState>()
registry.register([greetingAgent, authAgent, supportAgent])

const session = new ChatSession<AppState>({
  sessionId: 'user-456',
  store: new MemorySessionStore(),
  initialAgentId: 'greeting',
  initialState: { isAuthenticated: false },
})
```

### Conversation flow

```typescript
// Turn 1: User greets, greeting agent responds
await session.send('Hello!')
// => Greeting agent asks for name

// Turn 2: User provides name, greeting agent completes and chains to auth
await session.send("I'm Alex")
// => Auth agent asks for email verification
// (greeting → auth happened automatically in one request)

// Turn 3: User verifies, auth completes and chains to support
await session.send('alex@example.com')
// => Support agent asks how it can help
// State now: { userName: 'Alex', isAuthenticated: true }

// Turn 4: Support agent handles the issue
await session.send('I need help with my billing')
// => Support agent resolves the issue
// State: { userName: 'Alex', isAuthenticated: true, issueCategory: 'billing' }
```

Notice that:

- **State persists across agents**: `userName` set by the greeting agent is available to auth and support
- **Agent chaining is automatic**: when greeting completes, auth starts in the same request
- **Each agent has its own prompt and schema**: they extract different data but share the same state

## API Reference

### Core Exports

| Export | Type | Description |
|---|---|---|
| `ChatSession` | Class | Primary interface for sending messages and managing conversations |
| `AgentRegistry` | Class | Singleton registry for agent registration and lookup |
| `simpleAgentResponse` | Function | Default response generator for agents |
| `getAgentResponse` | Function | Low-level agent response pipeline (prompt, schema, LLM call, validation) |
| `manageFlow` | Function | Recursive chat flow orchestration with automatic agent chaining |
| `manageFlowStream` | Function | Streaming variant of `manageFlow` yielding `StreamEvent`s |
| `createFullOutputSchema` | Function | Merges agent schema with base response fields |
| `sendChatRequest` | Function | Sends structured requests to the LLM provider |
| `MemorySessionStore` | Class | In-memory session store for development and testing |
| `AgentCoreMemoryStore` | Class | AWS Bedrock AgentCore session store |

### ChatSession Methods

| Method | Returns | Description |
|---|---|---|
| `send(message)` | `Promise<ChatResponse<TState>>` | Send a user message and get the agent's response |
| `sendStream(message)` | `AsyncGenerator<StreamEvent<TState>>` | Send a message and stream the response as events |
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

## Comparison

| Capability | GenUI A3 | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| **Setup complexity** | Minimal | Moderate | Moderate | High |
| **Routing model** | Dynamic (agent-driven) | Static graph | Role-based | Conversation-based |
| **State management** | Shared global state | Graph state | Shared memory | Message passing |
| **TypeScript-native** | Yes | Python-first | Python-only | Python-first |
| **Structured output** | Zod schemas | Custom parsers | Pydantic | Custom parsers |
| **Session persistence** | Pluggable stores | Custom | Custom | Custom |

## Roadmap

- **Simplified Agent API** -- reduce agent definitions to just the essentials with sensible defaults
- **Provider Abstraction** -- first-class support for OpenAI, Anthropic, and custom providers alongside Bedrock
- **AG-UI Protocol** -- full compliance with the [ag-ui.com](https://ag-ui.com) protocol for standardized agent-to-frontend event streaming

## Requirements

- Node.js 20.19.0+
- TypeScript 5.9+
- `zod` 4.x (included as a dependency)
- A configured LLM provider (AWS Bedrock provider included)

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
