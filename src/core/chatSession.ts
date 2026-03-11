import { manageFlow, manageFlowStream } from './chatFlow'
import { AgentRegistry } from './AgentRegistry'
import { EventType } from '@ag-ui/client'
import {
  SessionStore,
  SessionData,
  BaseState,
  BaseChatContext,
  Agent,
  AgentId,
  Message,
  MessageSender,
  ChatResponse,
  ChatSessionConfig,
  StreamEvent,
  Provider,
} from 'types'
import { MemorySessionStore } from '@stores/memoryStore'

/**
 * ChatSession encapsulates the complete message lifecycle.
 *
 * @example
 * ```typescript
 * import { createBedrockProvider } from '@genui-a3/providers/bedrock'
 *
 * const provider = createBedrockProvider({
 *   models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
 * })
 *
 * const session = new ChatSession({
 *   sessionId: 'user-123',
 *   store: new RedisSessionStore(redis),
 *   initialAgentId: 'greeting',
 *   provider,
 * })
 *
 * // Blocking
 * const result = await session.send({ message: 'Hello!' })
 *
 * // Streaming
 * const stream = session.send({ message: 'Hello!', stream: true })
 * ```
 */
export class ChatSession<TState extends BaseState = BaseState, TContext extends BaseChatContext = BaseChatContext> {
  private readonly sessionId: string
  private readonly store: SessionStore<TState, TContext>
  private readonly initialAgentId: AgentId
  private readonly initialState: TState
  private readonly initialChatContext: TContext
  private readonly initialMessages?: Message[]
  private readonly provider: Provider

  constructor(config: ChatSessionConfig<TState, TContext>) {
    this.sessionId = config.sessionId
    this.store = config.store ?? (new MemorySessionStore<TState, TContext>() as SessionStore<TState, TContext>)
    this.initialAgentId = config.initialAgentId
    this.initialState = config.initialState ?? ({} as TState)
    this.initialChatContext = config.initialChatContext ?? ({} as TContext)
    this.initialMessages = config.initialMessages
    this.provider = config.provider
  }

  /**
   * Send a message and get a response (blocking).
   *
   * @param params - Message string or object with message and optional stream flag
   * @returns Promise resolving to ChatResponse when not streaming
   *
   * @example
   * ```typescript
   * // Blocking (returns Promise<ChatResponse>)
   * const result = await session.send({ message: 'Hello' })
   *
   * // Legacy string form (blocking)
   * const result = await session.send('Hello')
   * ```
   */
  async send(params: string | { message: string; stream?: false }): Promise<ChatResponse<TState>>
  /**
   * Send a message and stream the response.
   *
   * @param params - Object with message and stream: true
   * @returns AsyncGenerator yielding StreamEvents
   *
   * @example
   * ```typescript
   * const stream = session.send({ message: 'Hello', stream: true })
   * for await (const event of stream) {
   *   console.log(event)
   * }
   * ```
   */
  send(params: { message: string; stream: true }): AsyncGenerator<StreamEvent<TState>>
  send(
    params: string | { message: string; stream?: boolean },
  ): Promise<ChatResponse<TState>> | AsyncGenerator<StreamEvent<TState>> {
    const message = typeof params === 'string' ? params : params.message
    const stream = typeof params === 'string' ? false : params.stream === true

    if (stream) {
      return this.sendStreamInternal(message)
    }

    return this.sendBlocking(message)
  }

  /**
   * @deprecated Use `send({ message, stream: true })` instead.
   * Send a message and stream the response as an async generator of StreamEvents.
   */
  async *sendStream(message: string): AsyncGenerator<StreamEvent<TState>> {
    yield* this.sendStreamInternal(message)
  }

  private async sendBlocking(message: string): Promise<ChatResponse<TState>> {
    const context = await this.beforeProcessMessage(message)
    const result = await this.processMessage(context)
    return await this.afterProcessMessage(context.sessionData, result)
  }

  private async *sendStreamInternal(message: string): AsyncGenerator<StreamEvent<TState>> {
    const context = await this.beforeProcessMessage(message)

    let completedResponse: ChatResponse<TState> | null = null

    for await (const event of this.processMessageStream(context)) {
      if (event.type === EventType.RUN_FINISHED) {
        completedResponse = event.result ?? null
      }
      yield event
    }

    if (completedResponse) {
      await this.afterProcessMessage(context.sessionData, completedResponse)
    }
  }

  /**
   * Prepares the session data for sending a message.
   * Loads or creates the session, appends the user message, and returns the active agent.
   */
  private async beforeProcessMessage(message: string) {
    let sessionData = await this.store.load(this.sessionId)

    if (!sessionData) {
      sessionData = this.createInitialSession()
    }

    // Append user message
    const userMessage: Message = {
      text: message,
      metadata: { source: MessageSender.USER, timestamp: Date.now() },
    }
    sessionData.messages.push(userMessage)

    // Get active agent
    const registry = AgentRegistry.getInstance<TState, TContext>()
    const activeAgentId = sessionData.activeAgentId ?? this.initialAgentId
    const agent = registry.get(activeAgentId)

    if (!agent) {
      throw new Error(`Agent not found: ${activeAgentId}`)
    }

    return { sessionData, agent }
  }

  /**
   * Executes the agent flow to generate a completely buffered response.
   */
  private async processMessage(context: {
    sessionData: SessionData<TState, TContext>
    agent: Agent<TState, TContext>
  }) {
    return await manageFlow({
      ...context,
      stream: false,
      provider: this.provider,
    })
  }

  /**
   * Streams the agent flow execution event by event.
   */
  private async *processMessageStream(context: {
    sessionData: SessionData<TState, TContext>
    agent: Agent<TState, TContext>
  }): AsyncGenerator<StreamEvent<TState>> {
    yield* manageFlowStream<TState, TContext>({
      ...context,
      stream: true,
      provider: this.provider,
    })
  }

  /**
   * Finalizes the response by appending the assistant message, updating state,
   * refreshing chat context, and persisting the session.
   */
  private async afterProcessMessage(
    sessionData: SessionData<TState, TContext>,
    result: ChatResponse<TState>,
  ): Promise<ChatResponse<TState>> {
    // Append assistant response
    const assistantMessage: Message = {
      text: result.responseMessage,
      metadata: {
        source: MessageSender.ASSISTANT,
        timestamp: Date.now(),
        ...result.messageMetadata,
      },
      widgets: result.widgets,
    }
    sessionData.messages.push(assistantMessage)

    // Update session state
    sessionData.state = result.state
    sessionData.activeAgentId = result.nextAgentId ?? result.activeAgentId ?? sessionData.activeAgentId

    // Re-fetch chatContext to ensure consistency
    const latestSessionData = await this.store.load(this.sessionId)
    if (latestSessionData && latestSessionData.chatContext) {
      // eslint-disable-next-line require-atomic-updates
      sessionData.chatContext = latestSessionData.chatContext
    }

    await this.store.save(this.sessionId, sessionData)

    return result
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
