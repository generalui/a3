import type { BackoffConfig } from '@genui-a3/a3'

/**
 * Calculates the backoff delay for a given retry attempt.
 *
 * @param attempt - Zero-based attempt index (0 = first retry)
 * @param config - Backoff configuration with all fields required
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number, config: Required<BackoffConfig>): number {
  let delay: number

  switch (config.strategy) {
    case 'linear':
      delay = config.baseDelayMs * (attempt + 1)
      break
    case 'fixed':
      delay = config.baseDelayMs
      break
    case 'exponential':
    default:
      delay = config.baseDelayMs * Math.pow(2, attempt)
      break
  }

  delay = Math.min(delay, config.maxDelayMs)

  if (config.jitter) {
    delay = Math.random() * delay
  }

  return delay
}

/**
 * Sleeps for the specified duration. Can be aborted via an AbortSignal.
 *
 * @param ms - Duration in milliseconds
 * @param signal - Optional AbortSignal to cancel the sleep early
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error)
      return
    }

    const timer = setTimeout(resolve, ms)

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason as Error)
      },
      { once: true },
    )
  })
}
