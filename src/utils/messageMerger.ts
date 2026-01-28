// TODO: This is specific to Bedrock provider
import { Message as BedrockMessage } from '@aws-sdk/client-bedrock-runtime'
import { Conversation } from 'types'

export function mergeSequentialMessages(conversation: Conversation): BedrockMessage[] {
  if (conversation.length === 0) return []

  const result: BedrockMessage[] = []
  let currentMessage: BedrockMessage | null = null

  for (const message of conversation) {
    if (!message.text) continue
    const content = message.text
    if (!currentMessage) {
      currentMessage = {
        role: message.metadata?.source,
        content: [{ text: content }],
      }
    } else if (currentMessage.role === message.metadata?.source && currentMessage.content) {
      currentMessage.content.push({ text: content })
    } else {
      result.push(currentMessage)
      currentMessage = {
        role: message.metadata?.source,
        content: [{ text: content }],
      }
    }
  }

  if (currentMessage) {
    result.push(currentMessage)
  }

  return result
}
