# Transitions

Transitions control how agents hand off to each other in a multi-agent conversation.
Each agent's `transition` property determines when and how the conversation moves to the next agent.

For agent basics, see [Core Concepts](./CORE-CONCEPTS.md#agent).

## Three Transition Modes

A3 supports three transition modes based on what you assign to the `transition` property: **default** (omitted), **non-deterministic** (array), and **deterministic** (function).

### Default (`transition` Omitted)

When `transition` is not set, the agent stays active by default.
The `redirectToAgent` field is technically present in the LLM output schema as `z.string().nullable()`, but the base prompt restricts the LLM to only redirect to agents listed in its SPECIALIST AGENT POOL — which, without a `transition` array, contains only the agent itself.

```typescript
import { z } from 'zod'
import { Agent, BaseState } from '@genui/a3'

interface MyState extends BaseState {
  topic?: string
}

const assistantAgent: Agent<MyState> = {
  id: 'assistant',
  description: 'General assistant',
  prompt: 'You are a helpful assistant.',
  outputSchema: z.object({
    topic: z.string().optional(),
  }),
  // transition is omitted:
  // - Agent stays active each turn
  // - No other agents are shown in the SPECIALIST AGENT POOL
}
```

This is the right choice for single-agent setups or leaf agents that should not route anywhere.

### Non-Deterministic (`AgentId[]`)

When `transition` is an array of agent IDs, `redirectToAgent` is constrained to a `z.enum(...)` of those IDs.
The LLM must pick from the listed agents.
If the LLM returns an ID not in the array, Zod validation throws at parse time.

```typescript
const triageAgent: Agent<MyState> = {
  id: 'triage',
  description: 'Routes users to the appropriate department',
  prompt: `
    You are a triage agent. Based on the user's request, route them to:
    - "billing" for payment or invoice questions
    - "technical-support" for product issues
    - "account" for account management
  `,
  outputSchema: z.object({}),
  // LLM must pick from these three agents via redirectToAgent
  transition: ['billing', 'technical-support', 'account'],
}
```

The LLM output schema for this agent will include:

```typescript
redirectToAgent: z.enum(['billing', 'technical-support', 'account']).nullable()
```

### Deterministic (`(state, goalAchieved) => AgentId`)

When `transition` is a function, `redirectToAgent` is completely omitted from the LLM output schema.
Your code controls routing based on state and goal status.

```typescript
const authAgent: Agent<AppState> = {
  id: 'auth',
  description: 'Verifies user identity',
  prompt: 'Verify the user. Set goalAchieved when done.',
  outputSchema: z.object({
    isAuthenticated: z.boolean(),
  }),
  // Code decides routing — LLM has no say
  transition: (state, goalAchieved) => {
    if (goalAchieved && state.isAuthenticated) return 'main-menu'
    if (state.failedAttempts > 3) return 'escalation'
    return 'auth' // returning own ID = stay here
  },
}
```

The function receives:

- `state` -- the session state *after* `setState` has been applied for this turn
- `goalAchieved` -- the `goalAchieved` boolean from the LLM's response

Returning the agent's own ID keeps it active for the next turn.

## Choosing a Transition Mode

| Scenario | Mode | Why |
|---|---|---|
| Single agent or leaf agent | Omit `transition` | Agent stays active, no routing exposed |
| Triage hub with known targets | `AgentId[]` | LLM picks from a bounded set |
| Strict sequential workflow | `function` | Code controls ordering |
| Routing depends on state conditions | `function` | Logic in code, not prompt |

## Transition Mechanics

### Recursive Chaining

When an agent transitions to a different agent, `manageFlow` recursively invokes the next agent within the same `send()` call.
The intermediate agent's `chatbotMessage` becomes `lastAgentUnsentMessage`, which is injected into the next agent's system prompt as transition context.
The user sees a single response even if multiple agents were involved.

```text
User sends message
  → Agent A responds (chatbotMessage: "Let me transfer you...")
    → Agent B receives lastAgentUnsentMessage: "Let me transfer you..."
      → Agent B responds to user (this is what the user sees)
```

### Recursion Limit

A3 enforces a maximum number of automatic transitions per `send()` call to prevent infinite loops.
The default limit is **10**, configurable via `ChatSessionConfig.agentRecursionLimit`.
Only transitions to a *different* agent count toward the limit (staying on the same agent does not increment the counter).

When the limit is reached:

- The current agent's response is returned to the user
- `nextAgentId` in the response points to the blocked target agent
- A warning is logged

```typescript
const session = new ChatSession<MyState>({
  sessionId: 'user-123',
  store: new MemorySessionStore(),
  initialAgentId: 'triage',
  initialState: {},
  provider,
  agentRecursionLimit: 5, // lower limit for tighter control
})
```

### Streaming Transitions

During streaming, each transition yields an `AgentTransition` event with `{ fromAgentId, toAgentId }` between agents.
See the [StreamEvent table](./CORE-CONCEPTS.md#streamevent-types) in Core Concepts.

```typescript
for await (const event of session.send({ message: 'Help me', stream: true })) {
  if (event.type === 'AgentTransition') {
    console.log(`${event.fromAgentId} → ${event.toAgentId}`)
  }
}
```

## Non-Deterministic Routing Example

A complete triage pattern with LLM-driven routing:

```typescript
import { z } from 'zod'
import { Agent, AgentRegistry, ChatSession, MemorySessionStore, BaseState } from '@genui/a3'
import { createBedrockProvider } from '@genui/a3-bedrock'

interface SupportState extends BaseState {
  category?: string
  resolved: boolean
}

// Triage agent — LLM picks the target from a constrained set
const triageAgent: Agent<SupportState> = {
  id: 'triage',
  description: 'Routes users to the correct support department',
  prompt: `
    You are a triage agent. Determine what the user needs and route them:
    - "billing" for payment, invoices, or subscription questions
    - "technical-support" for bugs, errors, or product issues
    - "account" for password resets, profile changes, or access
    Always set redirectToAgent on your first response.
  `,
  outputSchema: z.object({
    category: z.string().optional(),
  }),
  transition: ['billing', 'technical-support', 'account'],
}

const billingAgent: Agent<SupportState> = {
  id: 'billing',
  description: 'Handles billing and payment questions',
  prompt: `
    You are a billing specialist. Help the user with payment or invoice issues.
    Set goalAchieved to true once the billing question is fully answered.
  `,
  outputSchema: z.object({ resolved: z.boolean() }),
  // Deterministic (function): code decides the next agent.
  transition: (_state, goalAchieved) => goalAchieved ? 'triage' : 'billing',
}

const technicalSupportAgent: Agent<SupportState> = {
  id: 'technical-support',
  description: 'Handles technical issues and bugs',
  prompt: `
    You are a technical support specialist. Help the user troubleshoot their issue.
    If the issue is resolved, redirect to triage so the user can raise other concerns.
    If you need more information, stay on this agent to continue troubleshooting.
  `,
  outputSchema: z.object({ resolved: z.boolean() }),
  // Non-deterministic (array): the LLM picks from the listed agents.
  transition: ['triage', 'technical-support'],
}

const accountAgent: Agent<SupportState> = {
  id: 'account',
  description: 'Handles account management',
  prompt: `
    You are an account specialist. Help the user manage their account.
  `,
  outputSchema: z.object({ resolved: z.boolean() }),
  // Default (omitted): agent stays active every turn.
}

// Setup
const registry = AgentRegistry.getInstance<SupportState>()
registry.register([triageAgent, billingAgent, technicalSupportAgent, accountAgent])

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
})

const session = new ChatSession<SupportState>({
  sessionId: 'support-001',
  store: new MemorySessionStore(),
  initialAgentId: 'triage',
  initialState: { resolved: false },
  provider,
})

// Conversation
const response = await session.send({ message: 'I got charged twice last month' })
// Triage agent sets redirectToAgent to "billing"
// → billing agent responds to the user in the same request
console.log(response.activeAgentId) // 'billing'
console.log(response.responseMessage) // Billing agent's response
```
