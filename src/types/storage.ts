import { SessionData, BaseChatContext, BaseState } from './session'

/**
 * Interface for session persistence.
 * Implement this to use Redis, DynamoDB, Postgres, etc.
 *
 * @example
 * ```typescript
 * class RedisSessionStore<TState extends BaseState, TContext extends BaseChatContext>
 *   implements SessionStore<TState, TContext> {
 *   constructor(private redis: RedisClient) {}
 *
 *   async load(sessionId: string): Promise<SessionData<TState, TContext> | null> {
 *     const data = await this.redis.get(`session:${sessionId}`)
 *     return data ? JSON.parse(data) : null
 *   }
 *
 *   async save(sessionId: string, data: SessionData<TState, TContext>): Promise<void> {
 *     await this.redis.set(`session:${sessionId}`, JSON.stringify(data))
 *   }
 *
 *   async delete(sessionId: string): Promise<void> {
 *     await this.redis.del(`session:${sessionId}`)
 *   }
 * }
 * ```
 */
export interface SessionStore<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> {
  /** Load session data, returns null if not found */
  load(sessionId: string): Promise<SessionData<TState, TContext> | null>

  /** Save session data */
  save(sessionId: string, data: SessionData<TState, TContext>): Promise<void>

  /** Delete a session (optional) */
  delete?(sessionId: string): Promise<void>
}
