# Core Concepts

## Agent

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
    return goalAchieved ? 'next-agent' : 'greeting' // replace 'next-agent' with a registered agent ID
  },
}
```

### Agent Properties

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

## AgentRegistry

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

## ChatSession

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

## State

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

## Output Schemas

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

## Routing

The `transition` property controls how an agent hands off to the next agent.
It supports three modes:

- **Default (omitted):** Agent stays active. No other agents are shown in the LLM's agent pool.
- **Non-deterministic (array):** The LLM picks from a bounded set of agent IDs via `redirectToAgent`.
- **Deterministic (function):** Your code decides the next agent — `redirectToAgent` is not exposed to the LLM.

```typescript
// Default — agent stays active, omit transition entirely
// (no routing targets exposed to the LLM)

// Non-deterministic — LLM picks from these
transition: ['billing', 'support', 'account']

// Deterministic — code controls routing
transition: (state, goalAchieved) => goalAchieved ? 'main-menu' : 'auth'
```

In all cases, when a transition happens, **ChatFlow recursively invokes the next agent** in the same request.
The user sees a single response, even if multiple agents were involved.

For the full transition reference — modes, mechanics, recursion limits, and examples — see [Transitions](./TRANSITIONS.md).

## Session Stores

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
See [Custom Stores](./CUSTOM_STORES.md) for a step-by-step implementation guide.

## Providers

Providers handle communication with LLM backends.
A3 uses a pluggable `Provider` interface.
Providers are separate packages -- see the [Providers documentation](./PROVIDERS.md).

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

- **Model fallback** (primary model fails -> falls back to next in list)
- **Blocking and streaming** modes
- **Structured output** via Zod schemas
- **Resilience** -- automatic retries with backoff, timeouts, and model fallback ([docs](./RESILIENCE.md))

See the [Providers documentation](./PROVIDERS.md) for full configuration options.
To build a provider for an LLM not listed above, see [Creating a Custom Provider](./CUSTOM_PROVIDERS.md).

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

## Streaming

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

### StreamEvent Types

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

## Custom generateResponse

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
