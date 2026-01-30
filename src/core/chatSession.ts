import { manageFlow } from './chatFlow'
import { AgentRegistry } from './AgentRegistry'
import {
  SessionStore,
  SessionData,
  BaseState,
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
export class ChatSession<TState extends BaseState = BaseState> {
  private readonly sessionId: string
  private readonly store: SessionStore<TState>
  private readonly initialAgentId: AgentId
  private readonly initialState: TState
  private readonly initialChatContext: Record<string, unknown>

  constructor(config: ChatSessionConfig<TState>) {
    this.sessionId = config.sessionId
    this.store = config.store ?? new MemorySessionStore<TState>()
    this.initialAgentId = config.initialAgentId
    this.initialState = config.initialState ?? ({} as TState)
    this.initialChatContext = config.initialChatContext ?? {}
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
    const registry = AgentRegistry.getInstance<TState>()
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
   * Get current session data without sending a message.
   */
  async getSessionData(): Promise<SessionData<TState> | null> {
    return this.store.load(this.sessionId)
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

  private createInitialSession(): SessionData<TState> {
    return {
      sessionId: this.sessionId,
      messages: [],
      activeAgentId: this.initialAgentId,
      state: this.initialState,
      chatContext: this.initialChatContext,
    }
  }
}
