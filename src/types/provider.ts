import { ZodType } from 'zod'
import { StreamEvent, BaseState } from 'types'

/**
 * Provider-agnostic message format for LLM communication.
 */
export interface ProviderMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Request payload sent to a provider.
 * Models are configured at provider creation time.
 */
export interface ProviderRequest {
  /** System prompt including agent instructions */
  systemPrompt: string
  /** Conversation messages */
  messages: ProviderMessage[]
  /** Zod schema for structured response validation */
  responseSchema: ZodType
}

/**
 * Structured response from a blocking provider request.
 */
export interface ProviderResponse {
  /** JSON string matching the response schema */
  content: string
  /** Optional token usage information */
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

/**
 * Universal provider interface for LLM communication.
 * Providers are pluggable — each implementation handles its own SDK, message formatting,
 * and stream conversion internally.
 *
 * @example
 * ```typescript
 * const provider = createBedrockProvider({
 *   models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
 * })
 *
 * const session = new ChatSession({
 *   sessionId: 'user-123',
 *   initialAgentId: 'greeting',
 *   provider,
 * })
 * ```
 */
export interface Provider {
  /** Blocking request that returns a structured JSON response */
  sendRequest(request: ProviderRequest): Promise<ProviderResponse>

  /** Streaming request that yields AG-UI compatible events */
  sendRequestStream<TState extends BaseState = BaseState>(request: ProviderRequest): AsyncIterable<StreamEvent<TState>>

  /** Human-readable name for logging */
  readonly name: string
}
