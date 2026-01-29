/**
 * ChatState represents the conversation state that agents use to make decisions.
 * Consumers can extend this with additional properties via the index signature.
 */
export type ChatState = {
  // Allow any additional properties for flexibility
  [key: string]: unknown
}
