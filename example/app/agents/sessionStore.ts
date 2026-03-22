import { ChatSession, MemorySessionStore, MessageSender, BaseState } from '@genui/a3'
import { getProvider } from '@providers'
import type { Message } from '@genui/a3'

const globalForStore = globalThis as unknown as {
  __a3SessionStore?: MemorySessionStore<BaseState>
}

/**
 * Get the shared session store, persisted on globalThis to survive HMR.
 */
export function getSessionStore<TState extends BaseState>(): MemorySessionStore<TState> {
  globalForStore.__a3SessionStore ??= new MemorySessionStore<BaseState>()
  return globalForStore.__a3SessionStore as unknown as MemorySessionStore<TState>
}

/**
 * Create a single assistant message from text.
 */
export function createInitialMessage(text: string): Message {
  return {
    messageId: crypto.randomUUID(),
    text,
    metadata: { source: MessageSender.ASSISTANT, timestamp: Date.now() },
  }
}

/**
 * Create a ChatSession with the shared store and provider.
 *
 * @param options - Session configuration
 * @returns A ChatSession instance configured with the shared store
 */
export function createChatSession<TState extends BaseState = BaseState>(options: {
  sessionId: string
  initialAgentId: string
  initialMessages?: Message[]
}): ChatSession<TState> {
  return new ChatSession<TState>({
    sessionId: options.sessionId,
    store: getSessionStore<TState>(),
    initialAgentId: options.initialAgentId,
    initialState: {} as TState,
    provider: getProvider(),
    initialMessages: options.initialMessages,
  })
}
