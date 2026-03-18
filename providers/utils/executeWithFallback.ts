import {
  A3ResilienceError,
  A3TimeoutError,
  DEFAULT_RESILIENCE_CONFIG,
  type ResilienceErrorEntry,
  type ResolvedResilienceConfig,
} from '@genui-a3/a3'
import { calculateBackoff, sleep } from './backoff'

/**
 * Builds an AbortSignal that fires when either the per-request timeout or total timeout expires.
 */
function buildSignal(requestTimeoutMs?: number, totalAbort?: AbortSignal): AbortSignal | undefined {
  const signals: AbortSignal[] = []

  if (requestTimeoutMs !== undefined) {
    signals.push(AbortSignal.timeout(requestTimeoutMs))
  }

  if (totalAbort) {
    signals.push(totalAbort)
  }

  if (signals.length === 0) return undefined
  if (signals.length === 1) return signals[0]
  return AbortSignal.any(signals)
}

type AttemptResult<T> = { ok: true; value: T } | { ok: false; error: Error }

async function attemptAction<T>(
  action: (model: string, signal?: AbortSignal) => Promise<T>,
  model: string,
  signal: AbortSignal | undefined,
  attempt: number,
  errors: ResilienceErrorEntry[],
): Promise<AttemptResult<T>> {
  try {
    const value = await action(model, signal)
    return { ok: true, value }
  } catch (error) {
    const errorObj = error as Error
    errors.push({ model, attempt, error: errorObj })
    return { ok: false, error: errorObj }
  }
}

function checkTotalTimeout(
  totalAbort: AbortController | undefined,
  timeoutMs: number | undefined,
  errors: ResilienceErrorEntry[],
): void {
  if (totalAbort?.signal.aborted) {
    throw new A3TimeoutError(`Total timeout of ${timeoutMs}ms exceeded`, errors)
  }
}

async function handleAttemptError(
  errorObj: Error,
  attempt: number,
  maxRetries: number,
  retryAll: boolean,
  resolved: ResolvedResilienceConfig,
  totalAbort: AbortController | undefined,
): Promise<'retry' | 'next-model'> {
  const isLastAttempt = attempt === 1 + maxRetries
  const isRetryable = retryAll || resolved.isRetryableError(errorObj)

  if (isRetryable && !isLastAttempt) {
    const delay = calculateBackoff(attempt - 1, resolved.backoff)
    await sleep(delay, totalAbort?.signal).catch(() => {
      // Sleep was aborted by total timeout — will be caught at top of loop
    })
    return 'retry'
  }

  return 'next-model'
}

/**
 * Executes an action with model fallback, retry, backoff, and timeout support.
 *
 * For each model (in priority order):
 * 1. Attempts the action up to `1 + maxAttempts` times
 * 2. On transient errors, waits with backoff before retrying
 * 3. On non-retryable errors (or after exhausting retries), falls back to the next model
 *
 * Throws `A3ResilienceError` with full error history when all models are exhausted.
 * Throws `A3TimeoutError` when the total timeout is exceeded.
 *
 * @param models - Model identifiers in priority order
 * @param action - Async action to attempt with each model. Receives an optional AbortSignal.
 * @param config - Resolved resilience configuration (defaults applied if omitted)
 * @returns The result from the first successful attempt
 * @throws {A3ResilienceError} When all models and retries are exhausted
 * @throws {A3TimeoutError} When the total timeout is exceeded
 *
 * @example
 * ```typescript
 * const result = await executeWithFallback(
 *   ['model-primary', 'model-fallback'],
 *   (model, signal) => provider.call(model, params, { abortSignal: signal }),
 *   resolvedConfig,
 * )
 * ```
 */
export async function executeWithFallback<T>(
  models: string[],
  action: (model: string, signal?: AbortSignal) => Promise<T>,
  config?: ResolvedResilienceConfig,
): Promise<T> {
  const resolved = config ?? DEFAULT_RESILIENCE_CONFIG
  const errors: ResilienceErrorEntry[] = []
  const maxRetries = resolved.retry === false ? 0 : resolved.retry.maxAttempts
  const retryAll = resolved.retry !== false && resolved.retry.retryOn === 'all'

  // Total timeout controller
  let totalAbort: AbortController | undefined
  let totalTimer: ReturnType<typeof setTimeout> | undefined

  if (resolved.timeout.totalTimeoutMs !== undefined) {
    totalAbort = new AbortController()
    totalTimer = setTimeout(
      () => totalAbort!.abort(new Error('Total timeout exceeded')),
      resolved.timeout.totalTimeoutMs,
    )
  }

  try {
    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
      const model = models[modelIndex]

      for (let attempt = 1; attempt <= 1 + maxRetries; attempt++) {
        checkTotalTimeout(totalAbort, resolved.timeout.totalTimeoutMs, errors)

        const signal = buildSignal(resolved.timeout.requestTimeoutMs, totalAbort?.signal)
        // eslint-disable-next-line no-await-in-loop
        const result = await attemptAction(action, model, signal, attempt, errors)
        if (result.ok) return result.value

        checkTotalTimeout(totalAbort, resolved.timeout.totalTimeoutMs, errors)

        // eslint-disable-next-line no-await-in-loop
        const decision = await handleAttemptError(result.error, attempt, maxRetries, retryAll, resolved, totalAbort)
        if (decision === 'next-model') break
      }
    }

    // All models exhausted
    throw new A3ResilienceError(
      `All models failed after ${errors.length} total attempt(s): ${models.join(', ')}`,
      errors,
    )
  } finally {
    if (totalTimer !== undefined) {
      clearTimeout(totalTimer)
    }
  }
}
