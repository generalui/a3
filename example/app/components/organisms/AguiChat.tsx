'use client'

import { useState, useCallback, useRef } from 'react'
import { ChatMessageList } from '@organisms/ChatMessageList'
import { ChatContainer } from '@atoms'
import { ChatInput } from '@molecules'
import { MessageSender } from '@genui-a3/a3'
import type { Message } from '@genui-a3/a3'
import { HttpAgent, EventType } from '@ag-ui/client'

const agent = new HttpAgent({
  url: '/api/agui',
})

interface AguiChatProps {
  initialMessages?: Message[]
  onSessionUpdate?: (update: { activeAgentId: string | null; state: Record<string, unknown> }) => void
}

export function AguiChat({ initialMessages, onSessionUpdate }: AguiChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const assistantIdRef = useRef<string>('')

  const handleSubmit = useCallback(async (text: string) => {
    const userMsg: Message = {
      messageId: crypto.randomUUID(),
      text,
      metadata: { source: MessageSender.USER },
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    let assistantId = crypto.randomUUID()
    assistantIdRef.current = assistantId

    const streamingMsg: Message = {
      messageId: assistantId,
      text: '',
      metadata: { source: MessageSender.ASSISTANT },
      isStreaming: true,
    }
    setMessages((prev) => [...prev, streamingMsg])

    try {
      const runId = crypto.randomUUID()

      // Add the user message to the agent's internal state BEFORE running.
      agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })

      await agent.runAgent(
        {
          runId,
          tools: [],
          context: [],
          forwardedProps: {},
        },
        {
          onEvent({ event }) {
            if (event.type === EventType.TEXT_MESSAGE_CONTENT && 'delta' in event) {
              const delta = (event as unknown as { delta: string }).delta
              setMessages((prev) => prev.map((m) => (m.messageId === assistantId ? { ...m, text: m.text + delta } : m)))
            } else if (event.type === EventType.CUSTOM && 'name' in event) {
              const customEvent = event as unknown as { name: string; value?: { toAgentId?: string; state?: Record<string, unknown> } }
              if (customEvent.name === 'AgentTransition') {
                onSessionUpdate?.({
                  activeAgentId: customEvent.value?.toAgentId ?? null,
                  state: customEvent.value?.state ?? {},
                })
                const prevAssistantId = assistantId
                assistantId = crypto.randomUUID()
                assistantIdRef.current = assistantId
                setMessages((prev) => {
                  const updated = prev.map((m) => (m.messageId === prevAssistantId ? { ...m, isStreaming: false } : m))
                  return [...updated, { messageId: assistantId, text: '', metadata: { source: MessageSender.ASSISTANT }, isStreaming: true }]
                })
              }
            } else if (event.type === EventType.RUN_FINISHED) {
              const result = (event as unknown as { result?: Record<string, unknown> }).result
              onSessionUpdate?.({
                activeAgentId: (result?.activeAgentId as string) ?? null,
                state: (result?.state as Record<string, unknown>) ?? {},
              })
              setMessages((prev) => prev.map((m) => (m.messageId === assistantId ? { ...m, isStreaming: false } : m)))
            } else if (event.type === EventType.RUN_ERROR) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.messageId === assistantId
                    ? { ...m, text: m.text || 'Sorry, something went wrong.', isStreaming: false }
                    : m,
                ),
              )
            }
          },
        },
      )
    } catch (error) {
      console.error('AG-UI chat error:', error)
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === assistantId
            ? { ...m, text: m.text || 'Sorry, something went wrong. Please try again.', isStreaming: false }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
      setMessages((prev) => prev.map((m) => (m.messageId === assistantId ? { ...m, isStreaming: false } : m)))
    }
  }, [onSessionUpdate])

  return (
    <ChatContainer elevation={0}>
      <ChatMessageList messages={messages} />
      <ChatInput onSubmit={handleSubmit} disabled={isLoading} />
    </ChatContainer>
  )
}
