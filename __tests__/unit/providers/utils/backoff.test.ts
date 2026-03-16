import { calculateBackoff, sleep } from '../../../../providers/utils/backoff'
import type { BackoffConfig } from '../../../../src/types/resilience'

jest.unmock('../../../../providers/utils/backoff')

describe('calculateBackoff', () => {
  describe('exponential strategy', () => {
    const config: Required<BackoffConfig> = {
      strategy: 'exponential',
      baseDelayMs: 500,
      maxDelayMs: 30_000,
      jitter: false,
    }

    it('should return baseDelay * 2^attempt', () => {
      expect(calculateBackoff(0, config)).toBe(500)   // 500 * 2^0 = 500
      expect(calculateBackoff(1, config)).toBe(1000)  // 500 * 2^1 = 1000
      expect(calculateBackoff(2, config)).toBe(2000)  // 500 * 2^2 = 2000
      expect(calculateBackoff(3, config)).toBe(4000)  // 500 * 2^3 = 4000
    })

    it('should cap at maxDelayMs', () => {
      expect(calculateBackoff(10, config)).toBe(30_000) // 500 * 2^10 = 512000, capped to 30000
    })
  })

  describe('linear strategy', () => {
    const config: Required<BackoffConfig> = {
      strategy: 'linear',
      baseDelayMs: 500,
      maxDelayMs: 30_000,
      jitter: false,
    }

    it('should return baseDelay * (attempt + 1)', () => {
      expect(calculateBackoff(0, config)).toBe(500)   // 500 * 1
      expect(calculateBackoff(1, config)).toBe(1000)  // 500 * 2
      expect(calculateBackoff(2, config)).toBe(1500)  // 500 * 3
    })

    it('should cap at maxDelayMs', () => {
      expect(calculateBackoff(100, config)).toBe(30_000)
    })
  })

  describe('fixed strategy', () => {
    const config: Required<BackoffConfig> = {
      strategy: 'fixed',
      baseDelayMs: 500,
      maxDelayMs: 30_000,
      jitter: false,
    }

    it('should return constant baseDelay', () => {
      expect(calculateBackoff(0, config)).toBe(500)
      expect(calculateBackoff(1, config)).toBe(500)
      expect(calculateBackoff(5, config)).toBe(500)
    })
  })

  describe('jitter', () => {
    it('should return a value between 0 and the calculated delay when jitter is enabled', () => {
      const config: Required<BackoffConfig> = {
        strategy: 'fixed',
        baseDelayMs: 1000,
        maxDelayMs: 30_000,
        jitter: true,
      }

      // Run multiple times to check randomness
      const values = Array.from({ length: 50 }, () => calculateBackoff(0, config))
      const allWithinRange = values.every((v) => v >= 0 && v <= 1000)
      const hasVariation = new Set(values).size > 1

      expect(allWithinRange).toBe(true)
      expect(hasVariation).toBe(true)
    })
  })
})

describe('sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should resolve after the specified duration', async () => {
    const promise = sleep(1000)
    jest.advanceTimersByTime(1000)
    await expect(promise).resolves.toBeUndefined()
  })

  it('should reject immediately if signal is already aborted', async () => {
    const controller = new AbortController()
    const reason = new Error('aborted')
    controller.abort(reason)

    await expect(sleep(1000, controller.signal)).rejects.toThrow('aborted')
  })

  it('should reject when signal is aborted during sleep', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled')

    const promise = sleep(5000, controller.signal)
    jest.advanceTimersByTime(1000)
    controller.abort(reason)

    await expect(promise).rejects.toThrow('cancelled')
  })
})
