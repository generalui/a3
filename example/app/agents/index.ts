import { ChatSession, MemorySessionStore, MessageSender } from '@genui/a3'
import { getProvider } from '@providers'
import type { State } from '@agents/state'
import type { Message } from '@genui/a3'
import { SESSION_INITIAL_MESSAGES } from '@constants/chat'

const globalForStore = globalThis as unknown as {
  __a3SessionStore?: MemorySessionStore<State>
}

/**
 * Get the shared session store, persisted on globalThis to survive HMR.
 */
function getSessionStore(): MemorySessionStore<State> {
  globalForStore.__a3SessionStore ??= new MemorySessionStore<State>()
  return globalForStore.__a3SessionStore
}

/**
 * Create a single assistant message from text.
 */
function createInitialMessage(text: string): Message {
  return {
    messageId: crypto.randomUUID(),
    text,
    metadata: { source: MessageSender.ASSISTANT, timestamp: Date.now() },
  }
}

/**
 * Build the default initial messages for a given session ID.
 */
function getDefaultInitialMessages(sessionId: string): Message[] | undefined {
  const text = SESSION_INITIAL_MESSAGES[sessionId]
  return text ? [createInitialMessage(text)] : undefined
}

/**
 * Get a ChatSession instance for the given session ID.
 *
 * @param options - Session configuration with optional overrides
 * @returns A ChatSession instance configured with the shared store
 */
export function getChatSessionInstance(options: {
  sessionId: string
  initialAgentId?: string
  initialMessages?: Message[]
}): ChatSession<State> {
  return new ChatSession<State>({
    sessionId: options.sessionId,
    store: getSessionStore(),
    initialAgentId: options.initialAgentId ?? 'greeting',
    initialState: { userName: undefined },
    provider: getProvider(),
    initialMessages: options.initialMessages ?? getDefaultInitialMessages(options.sessionId),
  })
}
