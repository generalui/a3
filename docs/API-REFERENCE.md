# API Reference

## Core Exports

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

## ChatSession Methods

| Method | Returns | Description |
|---|---|---|
| `send({ message })` | `Promise<ChatResponse<TState>>` | Send a user message and get the agent's response (blocking) |
| `send({ message, stream: true })` | `AsyncGenerator<StreamEvent<TState>>` | Send a message and stream the response as events |
| `getSessionData()` | `Promise<SessionData<TState> \| null>` | Load current session state without sending a message |
| `getOrCreateSessionData()` | `Promise<SessionData<TState>>` | Load session or create with initial values if none exists |
| `upsertSessionData(updates)` | `Promise<void>` | Merge partial updates into the current session |
| `getHistory()` | `Promise<Message[]>` | Retrieve conversation history |
| `clear()` | `Promise<void>` | Delete the session from the store |

## AgentRegistry Methods

| Method | Returns | Description |
|---|---|---|
| `getInstance()` | `AgentRegistry<TState>` | Get the singleton instance |
| `resetInstance()` | `void` | Reset the singleton (for testing) |
| `register(agents)` | `void` | Register one or more agents (throws on duplicate ID) |
| `unregister(agentOrId)` | `boolean` | Remove an agent by ID or agent instance |
| `get(id)` | `Agent<TState> \| undefined` | Look up an agent by ID |
| `getAll()` | `Agent<TState>[]` | Get all registered agents |
| `has(id)` | `boolean` | Check if an agent is registered |
| `getDescriptions()` | `Record<string, string>` | Map of agent IDs to their descriptions |
| `clear()` | `void` | Remove all registered agents (for testing) |
| `count` | `number` | Number of registered agents (getter) |

## ChatResponse Fields

| Field | Type | Description |
|---|---|---|
| `responseMessage` | `string` | The agent's text response to the user |
| `activeAgentId` | `string \| null` | The agent that generated this response |
| `nextAgentId` | `string \| null` | The agent that will handle the next message |
| `state` | `TState` | Updated session state after this turn |
| `goalAchieved` | `boolean` | Whether the agent considers its goal complete |
| `sessionId` | `string` | Session identifier |
| `widgets` | `object \| undefined` | Optional widget data for rich UI rendering |

## ChatSessionConfig

| Property | Type | Default | Description |
|---|---|---|---|
| `sessionId` | `string` | *required* | Unique session identifier |
| `store` | `SessionStore` | `undefined` | Storage adapter for session persistence |
| `initialAgentId` | `AgentId` | *required* | Agent to start the conversation |
| `initialState` | `TState` | `undefined` | Initial state for new sessions |
| `initialChatContext` | `TContext` | `undefined` | Initial chat context for new sessions |
| `initialMessages` | `Message[]` | `undefined` | Pre-populated conversation messages |
| `provider` | `Provider` | *required* | LLM provider instance for this session |
| `agentRecursionLimit` | `number` | `10` | Maximum automatic agent transitions per `send()` call. See [Transitions — Recursion Limit](./TRANSITIONS.md#recursion-limit) |

## Agent Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `AgentId` | Yes | Unique identifier for the agent |
| `description` | `string` | Yes | What this agent does (used in agent pool prompts) |
| `name` | `string` | No | Human-readable display name |
| `prompt` | `string \| (input) => Promise<string>` | Yes | System prompt string or async function returning the prompt |
| `outputSchema` | `ZodObject \| (sessionData) => ZodObject` | Yes | Zod schema defining structured data to extract from LLM responses |
| `provider` | `Provider` | No | Per-agent provider override; falls back to session-level provider |
| `generateResponse` | `(input) => Promise \| AsyncGenerator` | No | Custom response generator. See [Custom generateResponse](./CORE-CONCEPTS.md#custom-generateresponse) |
| `setState` | `(data, state) => TState` | No | Maps extracted LLM data into session state (defaults to shallow merge) |
| `transition` | `AgentId[] \| (state, goalAchieved) => AgentId` | No | Routing config. **Array**: LLM picks from listed IDs. **Function**: code decides. **Omitted**: LLM unconstrained. See [Transitions](./TRANSITIONS.md) |
| `filterHistoryStrategy` | `(messages) => Conversation` | No | Custom function to filter conversation history before sending to the LLM |
| `widgets` | `Record<string, ZodObject> \| (sessionData) => Record` | No | Zod schemas defining widgets available to the agent |
