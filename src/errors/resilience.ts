/**
 * Detailed record of a single failed attempt during resilience execution.
 */
export interface ResilienceErrorEntry {
  /** Model identifier that was attempted */
  readonly model: string
  /** Attempt number (1-based) within this model's retry cycle */
  readonly attempt: number
  /** The error that occurred */
  readonly error: Error
}

/**
 * Thrown when all models and retry attempts have been exhausted.
 * Preserves the full error history so consumers can inspect every failure.
 *
 * @example
 * ```typescript
 * try {
 *   await provider.sendRequest(request)
 * } catch (err) {
 *   if (err instanceof A3ResilienceError) {
 *     for (const entry of err.errors) {
 *       console.log(`${entry.model} attempt ${entry.attempt}: ${entry.error.message}`)
 *     }
 *   }
 * }
 * ```
 */
export class A3ResilienceError extends Error {
  readonly errors: ReadonlyArray<ResilienceErrorEntry>

  constructor(message: string, errors: ResilienceErrorEntry[]) {
    super(message)
    this.name = 'A3ResilienceError'
    this.errors = errors
  }
}

/**
 * Thrown when a total or per-request timeout is exceeded during resilience execution.
 * Extends `A3ResilienceError` so consumers can catch either type.
 */
export class A3TimeoutError extends A3ResilienceError {
  constructor(message: string, errors: ResilienceErrorEntry[]) {
    super(message, errors)
    this.name = 'A3TimeoutError'
  }
}
