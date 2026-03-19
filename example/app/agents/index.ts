import { ChatSession, MemorySessionStore, MessageSender } from '@genui-a3/a3'
import { getProvider } from '@providers'
import type { State } from '@agents/state'
import type { Message } from '@genui-a3/a3'
import { WELCOME_MESSAGE_TEXT, SESSION_IDS } from '@constants/chat'

/**
 * Shared session store for all API routes.
 */
let sessionStore: MemorySessionStore<State> | null = null

/**
 * Build the default initial messages for a given session ID.
 */
function getDefaultInitialMessages(sessionId: string): Message[] | undefined {
  if (sessionId === SESSION_IDS.ONBOARDING) {
    return [
      {
        messageId: crypto.randomUUID(),
        text: WELCOME_MESSAGE_TEXT,
        metadata: { source: MessageSender.ASSISTANT, timestamp: Date.now() },
      },
    ]
  }
  return undefined
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
  sessionStore ??= new MemorySessionStore<State>()
  return new ChatSession<State>({
    sessionId: options.sessionId,
    store: sessionStore,
    initialAgentId: options.initialAgentId ?? 'greeting',
    initialState: { userName: undefined },
    provider: getProvider(),
    initialMessages: options.initialMessages ?? getDefaultInitialMessages(options.sessionId),
  })
}
