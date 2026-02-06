import { SessionStore, SessionData, BaseState, BaseChatContext } from 'types'

/**
 * In-memory session store for development and testing.
 * Sessions are lost on process restart.
 *
 * @example
 * ```typescript
 * const store = new MemorySessionStore<MyState, MyContext>()
 * const session = new ChatSession({
 *   sessionId: 'test-123',
 *   store,
 *   initialAgentId: 'greeting',
 * })
 * ```
 */
export class MemorySessionStore<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> implements SessionStore<TState, TContext> {
  private sessions = new Map<string, SessionData<TState, TContext>>()

  load(sessionId: string): Promise<SessionData<TState, TContext> | null> {
    return Promise.resolve(this.sessions.get(sessionId) ?? null)
  }

  save(sessionId: string, data: SessionData<TState, TContext>): Promise<void> {
    this.sessions.set(sessionId, data)
    return Promise.resolve()
  }

  delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    return Promise.resolve()
  }

  /** Clear all sessions (useful for testing) */
  clear(): void {
    this.sessions.clear()
  }

  /** Get number of active sessions */
  get size(): number {
    return this.sessions.size
  }
}
