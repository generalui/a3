'use client'

import { useState, useCallback } from 'react'
import { CircularProgress } from '@mui/material'
import { ChatMessageList } from '@organisms/ChatMessageList'
import { ChatContainer, ChatHeader } from '@atoms'
import { ChatInput } from '@molecules'
import { MessageSender } from '@genui-a3/a3'
import type { Message } from '@genui-a3/a3'

type ChatApiResponse = {
  response: string
  activeAgentId: string | null
  nextAgentId: string | null
  state: Record<string, unknown>
  goalAchieved: boolean
}

interface ChatProps {
  sessionId: string
  initialMessages?: Message[]
  onSessionUpdate?: (update: { activeAgentId: string | null; state: Record<string, unknown> }) => void
}

export function Chat({ sessionId, initialMessages, onSessionUpdate }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? [])
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        messageId: crypto.randomUUID(),
        text,
        metadata: { source: MessageSender.USER },
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, sessionId }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }

        const data = (await response.json()) as ChatApiResponse

        onSessionUpdate?.({ activeAgentId: data.activeAgentId, state: data.state })

        const assistantMsg: Message = {
          messageId: crypto.randomUUID(),
          text: data.response,
          metadata: { source: MessageSender.ASSISTANT },
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (error) {
        console.error('Chat API error:', error)
        const errorMsg: Message = {
          messageId: crypto.randomUUID(),
          text: 'Sorry, something went wrong. Please try again.',
          metadata: { source: MessageSender.ASSISTANT },
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setIsLoading(false)
      }
    },
    [onSessionUpdate, sessionId],
  )

  return (
    <ChatContainer elevation={0}>
      <ChatHeader>{isLoading && <CircularProgress size={16} />}</ChatHeader>
      <ChatMessageList messages={messages} />
      <ChatInput onSubmit={handleSubmit} disabled={isLoading} />
    </ChatContainer>
  )
}
