import { executeWithFallback } from '@providers/utils/executeWithFallback'
import { A3ResilienceError, A3TimeoutError } from '@errors/resilience'
import { resolveResilienceConfig } from '@utils/resilience/defaults'
import type { ResolvedResilienceConfig } from 'types/resilience'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<ResolvedResilienceConfig>): ResolvedResilienceConfig {
  return {
    ...resolveResilienceConfig(),
    // Fast, deterministic backoff for tests
    backoff: { strategy: 'fixed', baseDelayMs: 1, maxDelayMs: 1, jitter: false },
    ...overrides,
  }
}

/** AWS SDK v3–style error with `$metadata.httpStatusCode` */
function makeAwsError(statusCode: number, name: string, message: string): Error {
  return Object.assign(new Error(message), {
    name,
    $metadata: { httpStatusCode: statusCode },
  })
}

/** Vercel AI SDK / OpenAI / Anthropic–style error with `.status` */
function makeApiError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status })
}

/** Network-level error (no status code, message-based classification) */
function makeNetworkError(message: string): Error {
  return new Error(message)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeWithFallback — integration (realistic SDK errors)', () => {
  describe('retry on transient errors', () => {
    it('should retry an AWS 429 ThrottlingException and succeed', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeAwsError(429, 'ThrottlingException', 'Rate exceeded'))
        .mockResolvedValue('success')

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })
      const result = await executeWithFallback(['us.anthropic.claude-sonnet-4-5-20250929-v1:0'], action, config)

      expect(result).toBe('success')
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should retry a Vercel AI SDK 503 error and succeed', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeApiError(503, 'Service temporarily unavailable'))
        .mockResolvedValue('ok')

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })
      const result = await executeWithFallback(['gpt-4o'], action, config)

      expect(result).toBe('ok')
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should retry on ECONNRESET network error', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeNetworkError('ECONNRESET: socket hang up'))
        .mockResolvedValue('recovered')

      const config = makeConfig({ retry: { maxAttempts: 1, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-1'], action, config)

      expect(result).toBe('recovered')
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should retry on AWS 503 ServiceUnavailableException', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeAwsError(503, 'ServiceUnavailableException', 'Service unavailable'))
        .mockRejectedValueOnce(makeAwsError(503, 'ServiceUnavailableException', 'Service unavailable'))
        .mockResolvedValue('finally')

      const config = makeConfig({ retry: { maxAttempts: 3, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-1'], action, config)

      expect(result).toBe('finally')
      expect(action).toHaveBeenCalledTimes(3)
    })

    it('should retry on Vercel AI SDK 429 rate_limit_exceeded', async () => {
      const action = jest.fn().mockRejectedValueOnce(makeApiError(429, 'rate_limit_exceeded')).mockResolvedValue('ok')

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })
      const result = await executeWithFallback(['claude-sonnet-4-5-20250929'], action, config)

      expect(result).toBe('ok')
      expect(action).toHaveBeenCalledTimes(2)
    })
  })

  describe('model fallback', () => {
    it('should exhaust retries on primary then succeed on fallback model', async () => {
      const action = jest
        .fn()
        // Primary model: 3 attempts (1 initial + 2 retries), all fail with 503
        .mockRejectedValueOnce(makeAwsError(503, 'ServiceUnavailableException', 'fail 1'))
        .mockRejectedValueOnce(makeAwsError(503, 'ServiceUnavailableException', 'fail 2'))
        .mockRejectedValueOnce(makeAwsError(503, 'ServiceUnavailableException', 'fail 3'))
        // Fallback model succeeds
        .mockResolvedValue('fallback-ok')

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-primary', 'model-fallback'], action, config)

      expect(result).toBe('fallback-ok')
      expect(action).toHaveBeenCalledTimes(4)
      // Verify model names passed to each call
      expect((action.mock.calls as unknown[][])[0][0]).toBe('model-primary')
      expect((action.mock.calls as unknown[][])[3][0]).toBe('model-fallback')
    })

    it('should skip retries on non-retryable error and immediately try fallback', async () => {
      const action = jest
        .fn()
        // Primary: 401 → not retryable, skip to fallback
        .mockRejectedValueOnce(makeApiError(401, 'invalid_api_key'))
        // Fallback succeeds
        .mockResolvedValue('fallback-ok')

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-1', 'model-2'], action, config)

      expect(result).toBe('fallback-ok')
      // Only 2 calls: 1 failed attempt on model-1, 1 success on model-2
      expect(action).toHaveBeenCalledTimes(2)
    })
  })

  describe('non-retryable errors skip retry', () => {
    it('should not retry a 400 Bad Request', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeApiError(400, 'invalid_request_error'))
        .mockRejectedValueOnce(makeApiError(400, 'invalid_request_error'))

      const config = makeConfig({ retry: { maxAttempts: 3, retryOn: 'transient' } })

      await expect(executeWithFallback(['model-1', 'model-2'], action, config)).rejects.toThrow(A3ResilienceError)
      // 1 attempt per model, no retries
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should not retry a 403 Forbidden (AWS AccessDeniedException)', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeAwsError(403, 'AccessDeniedException', 'Access denied'))
        .mockRejectedValueOnce(makeAwsError(403, 'AccessDeniedException', 'Access denied'))

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })

      await expect(executeWithFallback(['model-1', 'model-2'], action, config)).rejects.toThrow(A3ResilienceError)
      expect(action).toHaveBeenCalledTimes(2)
    })
  })

  describe('AbortError / TimeoutError not retried', () => {
    it('should not retry AbortError (intentional cancellation)', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'

      const action = jest.fn().mockRejectedValue(abortError)

      const config = makeConfig({ retry: { maxAttempts: 3, retryOn: 'transient' } })

      await expect(executeWithFallback(['model-1', 'model-2'], action, config)).rejects.toThrow(A3ResilienceError)
      // 1 attempt per model, no retries (AbortError is not retryable)
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should not retry TimeoutError', async () => {
      const timeoutError = new Error('The operation timed out')
      timeoutError.name = 'TimeoutError'

      const action = jest.fn().mockRejectedValue(timeoutError)

      const config = makeConfig({ retry: { maxAttempts: 3, retryOn: 'transient' } })

      await expect(executeWithFallback(['model-1'], action, config)).rejects.toThrow(A3ResilienceError)
      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  describe('all models fail → A3ResilienceError with full history', () => {
    it('should include every attempt in the error history', async () => {
      const errors = [
        makeAwsError(503, 'ServiceUnavailableException', 'primary fail 1'),
        makeAwsError(503, 'ServiceUnavailableException', 'primary fail 2'),
        makeApiError(429, 'rate_limit_exceeded'),
        makeApiError(429, 'rate_limit_exceeded'),
      ]

      const action = jest
        .fn()
        .mockRejectedValueOnce(errors[0])
        .mockRejectedValueOnce(errors[1])
        .mockRejectedValueOnce(errors[2])
        .mockRejectedValueOnce(errors[3])

      const config = makeConfig({ retry: { maxAttempts: 1, retryOn: 'transient' } })

      try {
        await executeWithFallback(['model-primary', 'model-fallback'], action, config)
        fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(A3ResilienceError)
        const resErr = err as A3ResilienceError

        expect(resErr.errors).toHaveLength(4)
        expect(resErr.errors[0]).toEqual({ model: 'model-primary', attempt: 1, error: errors[0] })
        expect(resErr.errors[1]).toEqual({ model: 'model-primary', attempt: 2, error: errors[1] })
        expect(resErr.errors[2]).toEqual({ model: 'model-fallback', attempt: 1, error: errors[2] })
        expect(resErr.errors[3]).toEqual({ model: 'model-fallback', attempt: 2, error: errors[3] })
        expect(resErr.message).toContain('model-primary')
        expect(resErr.message).toContain('model-fallback')
      }
    })

    it('should include mixed error types (AWS + network) in history', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeAwsError(503, 'ServiceUnavailableException', 'aws error'))
        .mockRejectedValueOnce(makeNetworkError('ECONNRESET: connection reset'))
        .mockRejectedValueOnce(makeApiError(500, 'internal_error'))

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })

      try {
        await executeWithFallback(['only-model'], action, config)
        fail('Should have thrown')
      } catch (err) {
        const resErr = err as A3ResilienceError
        expect(resErr.errors).toHaveLength(3)
        expect(resErr.errors[0].error.message).toBe('aws error')
        expect(resErr.errors[1].error.message).toBe('ECONNRESET: connection reset')
        expect(resErr.errors[2].error.message).toBe('internal_error')
      }
    })
  })

  describe('timeout enforcement', () => {
    it('should throw A3TimeoutError when totalTimeoutMs is exceeded', async () => {
      // Action that takes longer than the total timeout
      const action = jest.fn().mockImplementation(
        (_model: string, signal?: AbortSignal) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve('too-late'), 5000)
            signal?.addEventListener(
              'abort',
              () => {
                clearTimeout(timer)
                reject(signal.reason as Error)
              },
              { once: true },
            )
          }),
      )

      const config = makeConfig({
        retry: { maxAttempts: 0, retryOn: 'transient' },
        timeout: { requestTimeoutMs: undefined, totalTimeoutMs: 50 },
      })

      await expect(executeWithFallback(['model-1'], action, config)).rejects.toThrow(A3TimeoutError)
    }, 10_000)

    it('should throw A3TimeoutError during retry backoff when total timeout expires', async () => {
      const action = jest.fn().mockRejectedValue(makeAwsError(503, 'ServiceUnavailableException', 'unavailable'))

      const config = makeConfig({
        retry: { maxAttempts: 10, retryOn: 'transient' },
        // Slow backoff with short total timeout → should timeout during backoff
        backoff: { strategy: 'fixed', baseDelayMs: 200, maxDelayMs: 200, jitter: false },
        timeout: { requestTimeoutMs: undefined, totalTimeoutMs: 100 },
      })

      await expect(executeWithFallback(['model-1'], action, config)).rejects.toThrow(A3TimeoutError)
      // Should not have used all 10 retries — timeout cut it short
      expect(action.mock.calls.length).toBeLessThan(11)
    }, 10_000)
  })

  describe('AWS SDK v3 error shape classification', () => {
    it('should classify ThrottlingException (429) as retryable', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeAwsError(429, 'ThrottlingException', 'Rate exceeded'))
        .mockResolvedValue('ok')

      const config = makeConfig({ retry: { maxAttempts: 1, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-1'], action, config)

      expect(result).toBe('ok')
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should classify ModelNotReadyException (500) as retryable', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeAwsError(500, 'ModelNotReadyException', 'Model not ready'))
        .mockResolvedValue('ok')

      const config = makeConfig({ retry: { maxAttempts: 1, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-1'], action, config)

      expect(result).toBe('ok')
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should classify ValidationException (400) as non-retryable', async () => {
      const action = jest.fn().mockRejectedValue(makeAwsError(400, 'ValidationException', 'Invalid input'))

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })

      await expect(executeWithFallback(['model-1'], action, config)).rejects.toThrow(A3ResilienceError)
      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  describe('Vercel AI SDK error shape classification', () => {
    it('should classify status 429 as retryable', async () => {
      const action = jest.fn().mockRejectedValueOnce(makeApiError(429, 'rate_limit_exceeded')).mockResolvedValue('ok')

      const config = makeConfig({ retry: { maxAttempts: 1, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-1'], action, config)

      expect(result).toBe('ok')
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should classify status 529 (overloaded) as retryable', async () => {
      const action = jest.fn().mockRejectedValueOnce(makeApiError(529, 'overloaded')).mockResolvedValue('ok')

      const config = makeConfig({ retry: { maxAttempts: 1, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-1'], action, config)

      expect(result).toBe('ok')
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should classify status 401 as non-retryable', async () => {
      const action = jest.fn().mockRejectedValue(makeApiError(401, 'authentication_error'))

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })

      await expect(executeWithFallback(['model-1'], action, config)).rejects.toThrow(A3ResilienceError)
      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  describe('custom isRetryableError', () => {
    it('should use a custom classifier when provided', async () => {
      // Custom classifier: only retry errors with "CUSTOM_RETRY" in the message
      const customClassifier = (error: Error): boolean => error.message.includes('CUSTOM_RETRY')

      const action = jest.fn().mockRejectedValueOnce(new Error('CUSTOM_RETRY: temporary')).mockResolvedValue('ok')

      const config = makeConfig({
        retry: { maxAttempts: 1, retryOn: 'transient' },
        isRetryableError: customClassifier,
      })

      const result = await executeWithFallback(['model-1'], action, config)
      expect(result).toBe('ok')
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should not retry when custom classifier returns false', async () => {
      const customClassifier = (): boolean => false

      // Even a 503 won't be retried with this classifier
      const action = jest.fn().mockRejectedValue(makeApiError(503, 'Service unavailable'))

      const config = makeConfig({
        retry: { maxAttempts: 2, retryOn: 'transient' },
        isRetryableError: customClassifier,
      })

      await expect(executeWithFallback(['model-1'], action, config)).rejects.toThrow(A3ResilienceError)
      expect(action).toHaveBeenCalledTimes(1)
    })
  })
})
