import { executeWithFallback } from '../../../../providers/utils/executeWithFallback'
import { A3ResilienceError, A3TimeoutError } from '../../../../src/errors/resilience'
import { resolveResilienceConfig } from '../../../../src/utils/resilience/defaults'
import type { ResolvedResilienceConfig } from '../../../../src/types/resilience'

function makeTransientError(message = 'Service unavailable'): Error {
  return Object.assign(new Error(message), { status: 503 })
}

function makeAuthError(): Error {
  return Object.assign(new Error('Unauthorized'), { status: 401 })
}

function makeConfig(overrides?: Partial<ResolvedResilienceConfig>): ResolvedResilienceConfig {
  return {
    ...resolveResilienceConfig(),
    // Disable jitter for deterministic tests
    backoff: { strategy: 'fixed', baseDelayMs: 1, maxDelayMs: 1, jitter: false },
    ...overrides,
  }
}

describe('executeWithFallback', () => {
  describe('basic behavior', () => {
    it('should return the result on first success', async () => {
      const action = jest.fn().mockResolvedValue('success')
      const result = await executeWithFallback(['model-1'], action, makeConfig())
      expect(result).toBe('success')
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('should pass model name and signal to the action', async () => {
      const action = jest.fn().mockResolvedValue('ok')
      await executeWithFallback(['my-model'], action, makeConfig())
      expect(action).toHaveBeenCalledWith('my-model', undefined)
    })
  })

  describe('retries', () => {
    it('should retry transient errors up to maxAttempts per model', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeTransientError())
        .mockRejectedValueOnce(makeTransientError())
        .mockResolvedValue('success')

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-1'], action, config)

      expect(result).toBe('success')
      expect(action).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
    })

    it('should NOT retry non-transient errors', async () => {
      const action = jest.fn().mockRejectedValueOnce(makeAuthError()).mockRejectedValueOnce(makeAuthError())

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })

      await expect(executeWithFallback(['model-1', 'model-2'], action, config)).rejects.toThrow()

      // 1 attempt on model-1 (auth fail, not retried) + 1 attempt on model-2 (auth fail, not retried)
      expect(action).toHaveBeenCalledTimes(2)
    })

    it('should retry ALL errors when retryOn is "all"', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeAuthError())
        .mockRejectedValueOnce(makeAuthError())
        .mockResolvedValue('ok')

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'all' } })
      const result = await executeWithFallback(['model-1'], action, config)

      expect(result).toBe('ok')
      expect(action).toHaveBeenCalledTimes(3)
    })

    it('should respect retry: false (no retries)', async () => {
      const action = jest.fn().mockRejectedValueOnce(makeTransientError()).mockResolvedValue('fallback-ok')

      const config = makeConfig({ retry: false })
      const result = await executeWithFallback(['model-1', 'model-2'], action, config)

      expect(result).toBe('fallback-ok')
      // 1 attempt on model-1, 1 attempt on model-2 (no retries)
      expect(action).toHaveBeenCalledTimes(2)
    })
  })

  describe('model fallback', () => {
    it('should fall back to next model after exhausting retries', async () => {
      const action = jest
        .fn()
        .mockRejectedValueOnce(makeTransientError('fail-1'))
        .mockRejectedValueOnce(makeTransientError('fail-2'))
        .mockRejectedValueOnce(makeTransientError('fail-3')) // exhausted model-1
        .mockResolvedValue('model-2-success')

      const config = makeConfig({ retry: { maxAttempts: 2, retryOn: 'transient' } })
      const result = await executeWithFallback(['model-1', 'model-2'], action, config)

      expect(result).toBe('model-2-success')
      expect(action).toHaveBeenCalledTimes(4)
    })

    it('should throw A3ResilienceError when all models exhausted', async () => {
      const action = jest.fn().mockRejectedValue(makeTransientError())

      const config = makeConfig({ retry: { maxAttempts: 1, retryOn: 'transient' } })

      try {
        await executeWithFallback(['model-1', 'model-2'], action, config)
        fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(A3ResilienceError)
        const resErr = err as A3ResilienceError
        // model-1: 2 attempts (1 + 1 retry), model-2: 2 attempts
        expect(resErr.errors).toHaveLength(4)
        expect(resErr.errors[0].model).toBe('model-1')
        expect(resErr.errors[0].attempt).toBe(1)
        expect(resErr.errors[1].model).toBe('model-1')
        expect(resErr.errors[1].attempt).toBe(2)
        expect(resErr.errors[2].model).toBe('model-2')
        expect(resErr.errors[2].attempt).toBe(1)
        expect(resErr.errors[3].model).toBe('model-2')
        expect(resErr.errors[3].attempt).toBe(2)
      }
    })

    it('should preserve full error history in A3ResilienceError', async () => {
      const err1 = makeTransientError('error-1')
      const err2 = makeTransientError('error-2')

      const action = jest.fn().mockRejectedValueOnce(err1).mockRejectedValueOnce(err2)

      const config = makeConfig({ retry: false })

      try {
        await executeWithFallback(['model-1', 'model-2'], action, config)
        fail('Should have thrown')
      } catch (err) {
        const resErr = err as A3ResilienceError
        expect(resErr.errors[0].error).toBe(err1)
        expect(resErr.errors[1].error).toBe(err2)
      }
    })
  })

  describe('timeouts', () => {
    it('should pass an AbortSignal when requestTimeoutMs is set', async () => {
      const action = jest.fn().mockResolvedValue('ok')
      const config = makeConfig({
        timeout: { requestTimeoutMs: 5000, totalTimeoutMs: undefined },
      })

      await executeWithFallback(['model-1'], action, config)

      const signal = (action.mock.calls as unknown[][])[0][1] as AbortSignal | undefined
      expect(signal).toBeDefined()
    })

    it('should throw A3TimeoutError when totalTimeoutMs is exceeded', async () => {
      // Action that respects the abort signal (like a real HTTP client would)
      const action = jest.fn().mockImplementation(
        (_model: string, signal?: AbortSignal) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve('ok'), 5000)
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
  })

  describe('backward compatibility', () => {
    it('should work without config argument (uses defaults)', async () => {
      const action = jest.fn().mockResolvedValue('ok')
      const result = await executeWithFallback(['model-1'], action)
      expect(result).toBe('ok')
    })

    it('should behave like old code with retry disabled (just fallback)', async () => {
      const action = jest.fn().mockRejectedValueOnce(new Error('fail-1')).mockResolvedValue('fallback-ok')

      const config = makeConfig({ retry: false })
      const result = await executeWithFallback(['model-1', 'model-2'], action, config)

      expect(result).toBe('fallback-ok')
      expect(action).toHaveBeenCalledTimes(2)
    })
  })
})
