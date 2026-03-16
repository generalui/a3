import { ResolvedResilienceConfig, ResilienceConfig } from 'types/resilience'
import { isRetryableError } from './errorClassification'

/**
 * Fully resolved default resilience configuration.
 * 2 retries (3 total attempts), exponential backoff with jitter.
 */
export const DEFAULT_RESILIENCE_CONFIG: ResolvedResilienceConfig = {
  retry: {
    maxAttempts: 2,
    retryOn: 'transient',
  },
  backoff: {
    strategy: 'exponential',
    baseDelayMs: 500,
    maxDelayMs: 30_000,
    jitter: true,
  },
  timeout: {
    requestTimeoutMs: undefined,
    totalTimeoutMs: undefined,
  },
  isRetryableError,
}

/**
 * Merges a partial `ResilienceConfig` with defaults to produce a fully resolved config.
 *
 * @param config - Optional partial resilience configuration
 * @returns Fully resolved configuration with all fields populated
 *
 * @example
 * ```typescript
 * // Use all defaults
 * const resolved = resolveResilienceConfig()
 *
 * // Disable retries
 * const resolved = resolveResilienceConfig({ retry: false })
 *
 * // Custom retry count with default backoff
 * const resolved = resolveResilienceConfig({ retry: { maxAttempts: 5 } })
 * ```
 */
export function resolveResilienceConfig(config?: ResilienceConfig): ResolvedResilienceConfig {
  if (!config) return DEFAULT_RESILIENCE_CONFIG

  const defaults = DEFAULT_RESILIENCE_CONFIG
  const defaultRetry = defaults.retry as { maxAttempts: number; retryOn: 'transient' | 'all' }

  return {
    retry: resolveRetry(config.retry, defaultRetry),
    backoff: resolveBackoff(config.backoff, defaults.backoff),
    timeout: {
      requestTimeoutMs: config.timeout?.requestTimeoutMs ?? defaults.timeout.requestTimeoutMs,
      totalTimeoutMs: config.timeout?.totalTimeoutMs ?? defaults.timeout.totalTimeoutMs,
    },
    isRetryableError: config.isRetryableError ?? defaults.isRetryableError,
  }
}

function resolveRetry(
  input: ResilienceConfig['retry'],
  defaults: { maxAttempts: number; retryOn: 'transient' | 'all' },
): ResolvedResilienceConfig['retry'] {
  if (input === false) return false
  if (!input) return defaults
  return {
    maxAttempts: input.maxAttempts ?? defaults.maxAttempts,
    retryOn: input.retryOn ?? defaults.retryOn,
  }
}

function resolveBackoff(
  input: ResilienceConfig['backoff'],
  defaults: Required<import('types/resilience').BackoffConfig>,
): Required<import('types/resilience').BackoffConfig> {
  if (!input) return defaults
  return {
    strategy: input.strategy ?? defaults.strategy,
    baseDelayMs: input.baseDelayMs ?? defaults.baseDelayMs,
    maxDelayMs: input.maxDelayMs ?? defaults.maxDelayMs,
    jitter: input.jitter ?? defaults.jitter,
  }
}
