import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useRestart, type RestartResult } from '../../../../../example/app/lib/hooks/useRestart'

// Enable concurrent act environment to suppress console.error warnings
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let hookResult: ReturnType<typeof useRestart>

function TestComponent(props: {
  onRestart?: () => Promise<RestartResult>
  setMessages: React.Dispatch<React.SetStateAction<unknown[]>>
  onSessionUpdate?: (update: { activeAgentId: string | null; state: Record<string, unknown> }) => void
}) {
  const result = useRestart(props as Parameters<typeof useRestart>[0])
  hookResult = result
  return null
}

function renderHook(props: Parameters<typeof TestComponent>[0]) {
  const container = document.createElement('div')
  let root: ReturnType<typeof createRoot>
  act(() => {
    root = createRoot(container)
    root.render(React.createElement(TestComponent, props))
  })
  return {
    get current() {
      return hookResult
    },
    unmount() {
      act(() => root.unmount())
    },
  }
}

describe('useRestart', () => {
  it('returns undefined handleRestart when no onRestart provided', () => {
    const result = renderHook({ setMessages: jest.fn() })

    expect(result.current.handleRestart).toBeUndefined()
    result.unmount()
  })

  it('starts with isRestarting as false', () => {
    const result = renderHook({ onRestart: jest.fn(), setMessages: jest.fn() })

    expect(result.current.isRestarting).toBe(false)
    result.unmount()
  })

  it('calls onRestart, setMessages, and onSessionUpdate in sequence', async () => {
    const freshResult: RestartResult = {
      messages: [{ role: 'assistant', content: 'Hello' }] as RestartResult['messages'],
      activeAgentId: 'greeting',
      state: { step: 1 },
    }
    const onRestart = jest.fn().mockResolvedValue(freshResult)
    const setMessages = jest.fn()
    const onSessionUpdate = jest.fn()

    const result = renderHook({ onRestart, setMessages, onSessionUpdate })

    await act(async () => {
      await result.current.handleRestart!()
    })

    expect(onRestart).toHaveBeenCalled()
    expect(setMessages).toHaveBeenCalledWith(freshResult.messages)
    expect(onSessionUpdate).toHaveBeenCalledWith({
      activeAgentId: freshResult.activeAgentId,
      state: freshResult.state,
    })
    result.unmount()
  })

  it('sets isRestarting back to false even if onRestart throws', async () => {
    const onRestart = jest.fn().mockRejectedValue(new Error('fail'))
    const setMessages = jest.fn()

    const result = renderHook({ onRestart, setMessages })

    await act(async () => {
      await result.current.handleRestart!().catch(() => {})
    })

    expect(result.current.isRestarting).toBe(false)
    result.unmount()
  })

  it('returns handleRestart function when onRestart is provided', () => {
    const result = renderHook({ onRestart: jest.fn(), setMessages: jest.fn() })

    expect(typeof result.current.handleRestart).toBe('function')
    result.unmount()
  })
})
