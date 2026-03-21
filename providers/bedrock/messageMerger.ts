import { Message as BedrockMessage } from '@aws-sdk/client-bedrock-runtime'
import type { ProviderMessage } from '@genui/a3'

/**
 * Converts provider-agnostic messages to Bedrock format, merging sequential same-role messages.
 * Bedrock requires alternating user/assistant roles — this merges consecutive same-role messages
 * into a single message with multiple content blocks.
 */
export function mergeSequentialMessages(messages: ProviderMessage[]): BedrockMessage[] {
  if (messages.length === 0) return []

  const result: BedrockMessage[] = []
  let currentMessage: BedrockMessage | null = null

  for (const message of messages) {
    if (!message.content) continue

    if (!currentMessage) {
      currentMessage = {
        role: message.role,
        content: [{ text: message.content }],
      }
    } else if (currentMessage.role === message.role && currentMessage.content) {
      currentMessage.content.push({ text: message.content })
    } else {
      result.push(currentMessage)
      currentMessage = {
        role: message.role,
        content: [{ text: message.content }],
      }
    }
  }

  if (currentMessage) {
    result.push(currentMessage)
  }

  return result
}
