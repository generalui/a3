import { manageFlow } from './chatFlow'
import { AgentRegistry } from './AgentRegistry'
import {
  SessionStore,
  SessionData,
  BaseState,
  BaseChatContext,
  AgentId,
  Message,
  MessageSender,
  ChatResponse,
  ChatSessionConfig,
} from 'types'
import { MemorySessionStore } from '@stores/memoryStore'

/**
 * ChatSession encapsulates the complete message lifecycle.
 *
 * @example
 * ```typescript
 * const session = new ChatSession({
 *   sessionId: 'user-123',
 *   store: new RedisSessionStore(redis),
 *   initialAgentId: 'greeting',
 * })
 *
 * const result = await session.send('Hello!')
 * console.log(result.responseMessage)
 * ```
 */
export class ChatSession<TState extends BaseState = BaseState, TContext extends BaseChatContext = BaseChatContext> {
  private readonly sessionId: string
  private readonly store: SessionStore<TState, TContext>
  private readonly initialAgentId: AgentId
  private readonly initialState: TState
  private readonly initialChatContext: TContext
  private readonly initialMessages?: Message[]

  constructor(config: ChatSessionConfig<TState, TContext>) {
    this.sessionId = config.sessionId
    this.store = config.store ?? (new MemorySessionStore<TState, TContext>() as SessionStore<TState, TContext>)
    this.initialAgentId = config.initialAgentId
    this.initialState = config.initialState ?? ({} as TState)
    this.initialChatContext = config.initialChatContext ?? ({} as TContext)
    this.initialMessages = config.initialMessages
  }

  /**
   * Send a message and get a response.
   *
   * Flow:
   * 1. Load existing session or create new
   * 2. Append user message to history
   * 3. Run manageFlow with current agent
   * 4. Append assistant response to history
   * 5. Save updated session
   * 6. Return response
   */
  async send(message: string): Promise<ChatResponse<TState>> {
    // 1. Load or create session
    let sessionData = await this.store.load(this.sessionId)

    if (!sessionData) {
      sessionData = this.createInitialSession()
    }

    // 2. Append user message
    const userMessage: Message = {
      text: message,
      metadata: { source: MessageSender.USER, timestamp: Date.now() },
    }
    sessionData.messages.push(userMessage)

    // 3. Get active agent and run flow
    const registry = AgentRegistry.getInstance<TState, TContext>()
    const activeAgentId = sessionData.activeAgentId ?? this.initialAgentId
    const agent = registry.get(activeAgentId)

    if (!agent) {
      throw new Error(`Agent not found: ${activeAgentId}`)
    }

    const result = await manageFlow({
      agent,
      sessionData,
    })

    // 4. Append assistant response
    const assistantMessage: Message = {
      text: result.responseMessage,
      metadata: {
        source: MessageSender.ASSISTANT,
        timestamp: Date.now(),
        ...result.messageMetadata,
      },
    }
    sessionData.messages.push(assistantMessage)

    // 5. Update session state and save
    sessionData.state = result.newState
    sessionData.activeAgentId = result.nextAgentId ?? result.activeAgentId
    await this.store.save(this.sessionId, sessionData)

    // 6. Return response
    return {
      responseMessage: result.responseMessage,
      messageMetadata: result.messageMetadata,
      activeAgentId: result.activeAgentId,
      nextAgentId: result.nextAgentId,
      state: result.newState,
      goalAchieved: result.goalAchieved,
      sessionId: this.sessionId,
    }
  }

  /**
   * Gets or initializes session if it doesn't exist.
   */
  async getOrCreateSessionData(): Promise<SessionData<TState, TContext>> {
    const existing = await this.store.load(this.sessionId)

    if (existing) {
      return existing
    }

    const newSession = this.createInitialSession()
    await this.store.save(this.sessionId, newSession)
    return newSession
  }

  /**
   * Get current session data without sending a message.
   */
  async getSessionData(): Promise<SessionData<TState, TContext> | null> {
    return this.store.load(this.sessionId)
  }

  async upsertSessionData(updates: Partial<SessionData<TState, TContext>>): Promise<void> {
    let sessionData = await this.store.load(this.sessionId)

    if (!sessionData) {
      sessionData = this.createInitialSession()
    }

    Object.assign(sessionData, updates)
    await this.store.save(this.sessionId, sessionData)
  }

  /**
   * Get conversation history.
   */
  async getHistory(): Promise<Message[]> {
    const session = await this.store.load(this.sessionId)
    return session?.messages ?? []
  }

  /**
   * Clear/delete the session.
   */
  async clear(): Promise<void> {
    if (this.store.delete) {
      await this.store.delete(this.sessionId)
    }
  }

  private createInitialSession(): SessionData<TState, TContext> {
    return {
      sessionId: this.sessionId,
      messages: this.initialMessages ?? [],
      activeAgentId: this.initialAgentId,
      state: this.initialState,
      chatContext: this.initialChatContext,
    }
  }
}
