/**
 * Strategy used to calculate delay between retry attempts.
 * - `'exponential'` — baseDelay * 2^attempt (default)
 * - `'linear'` — baseDelay * (attempt + 1)
 * - `'fixed'` — constant baseDelay
 */
export type BackoffStrategy = 'exponential' | 'linear' | 'fixed'

/**
 * Configuration for retry behavior per model.
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts per model (not counting the initial attempt).
   * @default 2
   */
  maxAttempts?: number
  /**
   * Which errors to retry.
   * - `'transient'` — only retryable errors (429, 503, network failures, etc.)
   * - `'all'` — retry on any error
   * @default 'transient'
   */
  retryOn?: 'transient' | 'all'
}

/**
 * Configuration for backoff delays between retry attempts.
 */
export interface BackoffConfig {
  /**
   * Backoff strategy to use.
   * @default 'exponential'
   */
  strategy?: BackoffStrategy
  /**
   * Base delay in milliseconds for the first retry.
   * @default 500
   */
  baseDelayMs?: number
  /**
   * Maximum delay in milliseconds (cap for exponential/linear growth).
   * @default 30000
   */
  maxDelayMs?: number
  /**
   * Whether to add random jitter to the delay.
   * When true, the actual delay is randomized between 0 and the calculated value.
   * @default true
   */
  jitter?: boolean
}

/**
 * Configuration for request and total operation timeouts.
 */
export interface TimeoutConfig {
  /**
   * Timeout in milliseconds for each individual request attempt.
   * When undefined, the underlying SDK's default timeout is used.
   * @default undefined
   */
  requestTimeoutMs?: number
  /**
   * Timeout in milliseconds for the entire operation (all models and retries).
   * When undefined, there is no total timeout limit.
   * @default undefined
   */
  totalTimeoutMs?: number
}

/**
 * User-facing configuration for resilience behavior.
 * All fields are optional — unspecified fields use industry-standard defaults.
 *
 * @example
 * ```typescript
 * const provider = createBedrockProvider({
 *   models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
 *   resilience: {
 *     retry: { maxAttempts: 3 },
 *     backoff: { strategy: 'linear', baseDelayMs: 1000 },
 *     timeout: { totalTimeoutMs: 60_000 },
 *   },
 * })
 * ```
 */
export interface ResilienceConfig {
  /** Retry configuration, or `false` to disable retries entirely. */
  retry?: RetryConfig | false
  /** Backoff delay configuration between retries. */
  backoff?: BackoffConfig
  /** Timeout configuration for requests and total operation. */
  timeout?: TimeoutConfig
  /**
   * Custom function to determine if an error is retryable.
   * Overrides the built-in error classification when provided.
   */
  isRetryableError?: (error: Error) => boolean
}

/**
 * Internal resolved configuration with all fields required.
 * Used by `executeWithFallback` — consumers should use `ResilienceConfig` instead.
 */
export interface ResolvedResilienceConfig {
  retry: { maxAttempts: number; retryOn: 'transient' | 'all' } | false
  backoff: Required<BackoffConfig>
  timeout: { requestTimeoutMs: number | undefined; totalTimeoutMs: number | undefined }
  isRetryableError: (error: Error) => boolean
}
