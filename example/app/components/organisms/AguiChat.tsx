'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { ChatMessageList } from '@organisms/ChatMessageList'
import { ChatContainer, ChatHeader } from '@atoms'
import { ChatInput } from '@molecules'
import { MessageSender } from '@genui/a3'
import type { Message } from '@genui/a3'
import { HttpAgent, EventType } from '@ag-ui/client'
import { CHAT_ERROR, CHAT_ERROR_SHORT } from '@constants/ui'
import { useRestart, type RestartResult } from '@lib/hooks/useRestart'

interface AguiChatProps {
  sessionId: string
  initialMessages?: Message[]
  onSessionUpdate?: (update: { activeAgentId: string | null; state: Record<string, unknown> }) => void
  onRestart?: () => Promise<RestartResult>
}

export function AguiChat({ sessionId, initialMessages, onSessionUpdate, onRestart }: AguiChatProps) {
  const agent = useMemo(() => new HttpAgent({ url: '/api/agui', threadId: sessionId }), [sessionId])
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const assistantIdRef = useRef<string>('')
  const { isRestarting, handleRestart } = useRestart({ onRestart, setMessages, onSessionUpdate })

  const handleSubmit = useCallback(
    async (text: string) => {
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
                setMessages((prev) =>
                  prev.map((m) => (m.messageId === assistantId ? { ...m, text: m.text + delta } : m)),
                )
              } else if (event.type === EventType.CUSTOM && 'name' in event) {
                const customEvent = event as unknown as {
                  name: string
                  value?: { toAgentId?: string; state?: Record<string, unknown> }
                }
                if (customEvent.name === 'AgentTransition') {
                  onSessionUpdate?.({
                    activeAgentId: customEvent.value?.toAgentId ?? null,
                    state: customEvent.value?.state ?? {},
                  })
                  const prevAssistantId = assistantId
                  assistantId = crypto.randomUUID()
                  assistantIdRef.current = assistantId
                  setMessages((prev) => {
                    const updated = prev.map((m) =>
                      m.messageId === prevAssistantId ? { ...m, isStreaming: false } : m,
                    )
                    return [
                      ...updated,
                      {
                        messageId: assistantId,
                        text: '',
                        metadata: { source: MessageSender.ASSISTANT },
                        isStreaming: true,
                      },
                    ]
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
                    m.messageId === assistantId ? { ...m, text: m.text || CHAT_ERROR_SHORT, isStreaming: false } : m,
                  ),
                )
              }
            },
          },
        )
      } catch (error) {
        console.error('AG-UI chat error:', error)
        setMessages((prev) =>
          prev.map((m) => (m.messageId === assistantId ? { ...m, text: m.text || CHAT_ERROR, isStreaming: false } : m)),
        )
      } finally {
        setIsLoading(false)
        setMessages((prev) => prev.map((m) => (m.messageId === assistantId ? { ...m, isStreaming: false } : m)))
      }
    },
    [agent, onSessionUpdate],
  )

  return (
    <ChatContainer elevation={0}>
      <ChatHeader onRestart={() => void handleRestart?.()} isRestarting={isRestarting} />
      <ChatMessageList messages={messages} />
      <ChatInput onSubmit={(text) => void handleSubmit(text)} disabled={isLoading || isRestarting} />
    </ChatContainer>
  )
}
