import { SessionStore, SessionData, BaseState } from 'types'

/**
 * In-memory session store for development and testing.
 * Sessions are lost on process restart.
 *
 * @example
 * ```typescript
 * const store = new MemorySessionStore<MyState>()
 * const session = new ChatSession({
 *   sessionId: 'test-123',
 *   store,
 *   initialAgentId: 'greeting',
 * })
 * ```
 */
export class MemorySessionStore<TState extends BaseState = BaseState> implements SessionStore<TState> {
  private sessions = new Map<string, SessionData<TState>>()

  load(sessionId: string): Promise<SessionData<TState> | null> {
    return Promise.resolve(this.sessions.get(sessionId) ?? null)
  }

  save(sessionId: string, data: SessionData<TState>): Promise<void> {
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
