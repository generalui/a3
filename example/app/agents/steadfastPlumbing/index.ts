import { createChatSession, createInitialMessage } from '@agents/sessionStore'
import type { PlumbingState } from './state'

export { initRegistry } from './registry'

export const SESSION_ID = 'steadfast-plumbing'

const INITIAL_MESSAGE_TEXT = `Hey there! You've reached **Steadfast Plumbing Co.** — fixing what drips, clogs, and goes bump in the night since '87.

Whether your toilet's running (you should probably go catch it) or something more serious — we've got you covered. What's going on?`

/**
 * Get a ChatSession instance for the Steadfast Plumbing example.
 */
export function getChatSessionInstance(sessionId: string) {
  return createChatSession<PlumbingState>({
    sessionId,
    initialAgentId: 'intake',
    initialMessages: [createInitialMessage(INITIAL_MESSAGE_TEXT)],
  })
}
