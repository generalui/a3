import { createChatSession, createInitialMessage } from '@agents/sessionStore'
import type { HelloWorldState } from './state'

export { initRegistry } from './registry'

export const SESSION_ID = 'hello-world'

const INITIAL_MESSAGE_TEXT = `Hi there! I'm the greeting agent for this Hello World demo. Let's start simple — what's your name?`

/**
 * Get a ChatSession instance for the Hello World example.
 */
export function getChatSessionInstance(sessionId: string) {
  return createChatSession<HelloWorldState>({
    sessionId,
    initialAgentId: 'greeting',
    initialMessages: [createInitialMessage(INITIAL_MESSAGE_TEXT)],
  })
}
