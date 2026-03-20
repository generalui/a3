# Creating a Custom Session Store

This guide walks you through implementing a custom `SessionStore` so A3 can persist sessions to any backend — DynamoDB, Redis, PostgreSQL, or anything else.

## When to Create a Custom Store

Create a custom store when you need:

1. **Production persistence** — sessions that survive process restarts (the built-in `MemorySessionStore` doesn't)
1. **Shared storage** — multiple server instances reading/writing the same sessions (e.g. behind a load balancer)
1. **TTL / expiration** — automatic cleanup of stale sessions
1. **Audit or compliance** — durable session records with timestamps

## The SessionStore Interface

Every store implements the `SessionStore` interface from `@genui/a3`:

```typescript
import { SessionData, BaseState, BaseChatContext } from '@genui/a3'

interface SessionStore<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> {
  /** Load session data, returns null if not found */
  load(sessionId: string): Promise<SessionData<TState, TContext> | null>

  /** Save session data */
  save(sessionId: string, data: SessionData<TState, TContext>): Promise<void>

  /** Delete a session (optional) */
  delete?(sessionId: string): Promise<void>
}
```

| Method | Required | Description |
|---|---|---|
| `load(sessionId)` | Yes | Retrieve session data by ID. Return `null` if no session exists. |
| `save(sessionId, data)` | Yes | Persist the full `SessionData` object. Called after every turn. |
| `delete(sessionId)` | No | Remove a session. Useful for cleanup, logout, or TTL expiration. |

## SessionData Structure

`SessionData` is the object your store serializes and deserializes:

```typescript
interface SessionData<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> {
  sessionId: string
  messages: Conversation         // Array of Message objects (full chat history)
  conversationHistory?: Conversation  // Previous messages when re-authenticating
  activeAgentId: AgentId | null  // Currently active agent
  state: TState                  // Shared state across all agents
  chatContext: TContext           // Context variables for the current session
}
```

| Field | Description |
|---|---|
| `sessionId` | Unique identifier for the session |
| `messages` | Full conversation history (user and assistant messages) |
| `conversationHistory` | Optional backup of previous messages (used during re-authentication flows) |
| `activeAgentId` | The agent that will handle the next user message, or `null` |
| `state` | Shared typed state flowing across all agents — your `TState` extension of `BaseState` |
| `chatContext` | Session-level context — your `TContext` extension of `BaseChatContext` |

## Implementing a Custom Store

### Step 1: Implement `load`

Retrieve the session from your backend and deserialize it.
Return `null` if the session doesn't exist.

```typescript
async load(sessionId: string): Promise<SessionData<TState, TContext> | null> {
  const raw = await this.client.get(sessionId)
  return raw ? JSON.parse(raw) : null
}
```

### Step 2: Implement `save`

Serialize the `SessionData` and write it to your backend.
This is called after every turn, so it must handle both inserts and updates.

```typescript
async save(sessionId: string, data: SessionData<TState, TContext>): Promise<void> {
  await this.client.set(sessionId, JSON.stringify(data))
}
```

### Step 3: Implement `delete` (optional)

Remove a session from your backend.
If your backend supports TTL natively, you may not need this.

```typescript
async delete(sessionId: string): Promise<void> {
  await this.client.delete(sessionId)
}
```

## Example: DynamoDB Store

A complete, copy-pasteable implementation using the AWS SDK v3:

```typescript
import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import type { SessionStore, SessionData, BaseState, BaseChatContext } from '@genui/a3'

export class DynamoSessionStore<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> implements SessionStore<TState, TContext> {
  private tableName: string
  private client: DynamoDBDocumentClient

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client
    this.tableName = tableName
  }

  async load(sessionId: string): Promise<SessionData<TState, TContext> | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { id: sessionId },
      }),
    )

    if (!result.Item?.data) {
      return null
    }

    return JSON.parse(result.Item.data as string) as SessionData<TState, TContext>
  }

  async save(sessionId: string, data: SessionData<TState, TContext>): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          id: sessionId,
          data: JSON.stringify(data),
          updatedAt: new Date().toISOString(),
        },
      }),
    )
  }

  async delete(sessionId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { id: sessionId },
      }),
    )
  }
}
```

## Using Your Store

Pass your store to `ChatSession` via the `store` option:

```typescript
import { ChatSession } from '@genui/a3'
import { createBedrockProvider } from '@genui/a3-bedrock'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoSessionStore } from './dynamoSessionStore'

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const session = new ChatSession({
  sessionId: 'user-123',
  store: new DynamoSessionStore(dynamoClient, 'my-sessions-table'),
  initialAgentId: 'greeting',
  provider: createBedrockProvider({ models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'] }),
})

const result = await session.send({ message: 'Hello!' })
```

## Gotchas and Tips

### Serialization

`SessionData` contains plain objects and arrays — `JSON.stringify` / `JSON.parse` works for most backends.
If your state includes `Date` objects, `Map`, `Set`, or class instances, you'll need a custom serializer (e.g. `superjson`).

### TTL and Expiration

A3 doesn't manage TTL.
Use your backend's native TTL feature (e.g. DynamoDB TTL, Redis `EXPIRE`) and set it in `save`.

### Concurrency

`save` is called after every turn.
If a user sends rapid messages, two `save` calls may race.
For most backends (Redis `SET`, DynamoDB `PutItem`) last-write-wins is fine.
If you need stronger guarantees, use conditional writes or optimistic locking.

### Typing

`SessionStore` is generic over `TState` and `TContext`.
Type your store class to match your application's state:

```typescript
const store = new DynamoSessionStore<MyAppState, MyAppContext>(client, 'sessions')
```

### Store is Optional

`ChatSession` works without a store — sessions live only in the `ChatSession` instance's memory.
If you omit `store`, session data is never persisted and is lost when the instance is garbage collected.

## Reference

| File | Description |
|---|---|
| `src/types/storage.ts` | `SessionStore` interface |
| `src/types/session.ts` | `SessionData`, `BaseState`, `BaseChatContext` interfaces |
| `src/stores/memoryStore.ts` | `MemorySessionStore` — built-in in-memory implementation |
| `src/core/chatSession.ts` | `ChatSession` — where stores are consumed |
