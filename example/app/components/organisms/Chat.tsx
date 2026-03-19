'use client'

import { useState, useCallback } from 'react'
import { CircularProgress, Typography } from '@mui/material'
import { ChatMessageList } from '@organisms/ChatMessageList'
import { ChatContainer, ChatHeader } from '@atoms'
import { ChatInput } from '@molecules'
import type { ChatMessage as ChatMessageType } from 'types'

const SESSION_ID = 'demo-session'

type ChatApiResponse = {
  response: string
  activeAgentId: string | null
  nextAgentId: string | null
  state: Record<string, unknown>
  goalAchieved: boolean
}

interface ChatProps {
  onSessionUpdate?: (update: { activeAgentId: string | null; state: Record<string, unknown> }) => void
}

export function Chat({ onSessionUpdate }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = useCallback(
    async (text: string) => {
      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        body: text,
        source: 'user',
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, sessionId: SESSION_ID }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }

        const data = (await response.json()) as ChatApiResponse

        onSessionUpdate?.({ activeAgentId: data.activeAgentId, state: data.state })

        const assistantMsg: ChatMessageType = {
          id: crypto.randomUUID(),
          body: data.response,
          source: 'assistant',
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (error) {
        console.error('Chat API error:', error)
        const errorMsg: ChatMessageType = {
          id: crypto.randomUUID(),
          body: 'Sorry, something went wrong. Please try again.',
          source: 'assistant',
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setIsLoading(false)
      }
    },
    [onSessionUpdate],
  )

  return (
    <ChatContainer elevation={0}>
      <ChatHeader>{isLoading && <CircularProgress size={16} />}</ChatHeader>
      <ChatMessageList messages={messages} />
      <ChatInput onSubmit={handleSubmit} disabled={isLoading} />
    </ChatContainer>
  )
}
