import { Conversation } from 'types'
import { AUTH_MESSAGES } from '@constants/messages'

/**
 * Filters out all auth-related messages from conversation history
 * to prevent confusion from prior auth attempts
 */
export function excludeAuthMessages(messages: Conversation): Conversation {
  const authValues = Object.values(AUTH_MESSAGES)
    .map((value) => {
      if (typeof value === 'function') {
        // Skip function-based messages as they're dynamic
        return null
      }
      return value.toLowerCase()
    })
    .filter(Boolean) as string[]

  return messages.filter((msg) => {
    if (!msg.text) return true
    const text = msg.text.toLowerCase()
    return !authValues.some((authMsg) => text.includes(authMsg))
  })
}
