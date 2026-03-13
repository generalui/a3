# Quick Start

The fastest way to get started with A3 is using the interactive CLI. It scaffolds a full Next.js application, configures your LLM providers, and installs dependencies.

```bash
npx @genui-a3/create@latest
```

Follow the prompts to name your project and provide your API keys. Once finished:

```bash
cd your-project-name
npm run dev
```

For more details on the CLI, see the [@genui-a3/create README](https://www.npmjs.com/package/@genui-a3/create).

---

## Manual Installation

If you are adding A3 to an existing project or prefer a manual setup, follow these steps.

### Install

```bash
npm install @genui-a3/core
```

## Define an agent

```typescript
import { z } from 'zod'
import { Agent, BaseState } from '@genui-a3/core'

interface State extends BaseState {
  userName?: string
}

export const greetingAgent: Agent<State> = {
  id: 'greeting',
  name: 'Greeting Agent',
  description: 'Greets the user and collects their name',
  prompt: async () => `
    You are a friendly greeting agent. Your goal is to greet the user
    and learn their name. Once you have their name, set goalAchieved to true.
  `,
  outputSchema: z.object({
    userName: z.string().optional(),
  }),
  transition: (_state, goalAchieved) =>
    goalAchieved ? 'end' : 'greeting',
}
```

## Register and run

```typescript
import { AgentRegistry, ChatSession, MemorySessionStore } from '@genui-a3/core'
import { createBedrockProvider } from '@genui-a3/providers/bedrock'

const registry = AgentRegistry.getInstance<State>()
registry.register(greetingAgent)

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
})

const session = new ChatSession<State>({
  sessionId: 'demo',
  store: new MemorySessionStore(),
  initialAgentId: 'greeting',
  initialState: { userName: undefined },
  provider,
})

const response = await session.send({ message: 'Hi there!' })
console.log(response.responseMessage)
// => "Hello! I'd love to get to know you. What's your name?"
```

That's it.
One agent, one session, one function call.

## Multi-Agent Example

Here's a pattern with three agents that route between each other, demonstrating how state flows across agent boundaries.

### Define the agents

```typescript
import { z } from 'zod'
import { Agent, BaseState } from '@genui-a3/core'

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
  prompt: async () => `
    Greet the user warmly. Ask for their name.
    Once you have it, set goalAchieved to true.
  `,
  outputSchema: z.object({ userName: z.string().optional() }),
  transition: (_state, goalAchieved) =>
    goalAchieved ? 'auth' : 'greeting',
}

// Agent 2: Auth -- verifies identity, then routes to support
const authAgent: Agent<AppState> = {
  id: 'auth',
  name: 'Auth Agent',
  description: 'Verifies user identity',
  prompt: async ({ sessionData }) => `
    The user's name is ${sessionData.state.userName}.
    Ask them to confirm their email to verify identity.
    Set goalAchieved to true once verified.
  `,
  outputSchema: z.object({ isAuthenticated: z.boolean() }),
  transition: (_state, goalAchieved) =>
    goalAchieved ? 'support' : 'auth',
}

// Agent 3: Support -- handles the user's issue
const supportAgent: Agent<AppState> = {
  id: 'support',
  name: 'Support Agent',
  description: 'Helps resolve user issues',
  prompt: async ({ sessionData }) => `
    The user ${sessionData.state.userName} is authenticated.
    Help them with their issue. Categorize it.
    Set goalAchieved when resolved.
  `,
  outputSchema: z.object({
    issueCategory: z.string().optional(),
  }),
  transition: (_state, goalAchieved) =>
    goalAchieved ? 'end' : 'support',
}
```

### Wire them up

```typescript
import { AgentRegistry, ChatSession, MemorySessionStore } from '@genui-a3/core'
import { createBedrockProvider } from '@genui-a3/providers/bedrock'

const registry = AgentRegistry.getInstance<AppState>()
registry.register([greetingAgent, authAgent, supportAgent])

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
})

const session = new ChatSession<AppState>({
  sessionId: 'user-456',
  store: new MemorySessionStore(),
  initialAgentId: 'greeting',
  initialState: { isAuthenticated: false },
  provider,
})
```

### Conversation flow

```typescript
// Turn 1: User greets, greeting agent responds
await session.send({ message: 'Hello!' })
// => Greeting agent asks for name

// Turn 2: User provides name, greeting agent completes and chains to auth
await session.send({ message: "I'm Alex" })
// => Auth agent asks for email verification
// (greeting → auth happened automatically in one request)

// Turn 3: User verifies, auth completes and chains to support
await session.send({ message: 'alex@example.com' })
// => Support agent asks how it can help
// State now: { userName: 'Alex', isAuthenticated: true }

// Turn 4: Support agent handles the issue
await session.send({ message: 'I need help with my billing' })
// => Support agent resolves the issue
// State: { userName: 'Alex', isAuthenticated: true, issueCategory: 'billing' }
```

Notice that:

- **State persists across agents**: `userName` set by the greeting agent is available to auth and support
- **Agent chaining is automatic**: when greeting completes, auth starts in the same request
- **Each agent has its own prompt and schema**: they extract different data but share the same state
