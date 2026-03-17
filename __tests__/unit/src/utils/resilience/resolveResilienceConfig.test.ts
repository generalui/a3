import { resolveResilienceConfig, DEFAULT_RESILIENCE_CONFIG } from '@utils/resilience'

describe('resolveResilienceConfig', () => {
  it('should return DEFAULT_RESILIENCE_CONFIG when called with no arguments', () => {
    const result = resolveResilienceConfig()
    expect(result).toBe(DEFAULT_RESILIENCE_CONFIG)
  })

  it('should return DEFAULT_RESILIENCE_CONFIG when called with undefined', () => {
    const result = resolveResilienceConfig(undefined)
    expect(result).toBe(DEFAULT_RESILIENCE_CONFIG)
  })

  it('should merge partial retry config with defaults', () => {
    const result = resolveResilienceConfig({ retry: { maxAttempts: 5 } })
    expect(result.retry).toEqual({ maxAttempts: 5, retryOn: 'transient' })
  })

  it('should merge partial backoff config with defaults', () => {
    const result = resolveResilienceConfig({ backoff: { strategy: 'linear' } })
    expect(result.backoff).toEqual({
      strategy: 'linear',
      baseDelayMs: 500,
      maxDelayMs: 30_000,
      jitter: true,
    })
  })

  it('should disable retries when retry is false', () => {
    const result = resolveResilienceConfig({ retry: false })
    expect(result.retry).toBe(false)
  })

  it('should override retryOn', () => {
    const result = resolveResilienceConfig({ retry: { retryOn: 'all' } })
    expect(result.retry).toEqual({ maxAttempts: 2, retryOn: 'all' })
  })

  it('should merge partial timeout config with defaults', () => {
    const result = resolveResilienceConfig({ timeout: { requestTimeoutMs: 5000 } })
    expect(result.timeout).toEqual({ requestTimeoutMs: 5000, totalTimeoutMs: undefined })
  })

  it('should accept custom isRetryableError function', () => {
    const custom = () => true
    const result = resolveResilienceConfig({ isRetryableError: custom })
    expect(result.isRetryableError).toBe(custom)
  })

  it('should use default isRetryableError when not provided', () => {
    const result = resolveResilienceConfig({ retry: { maxAttempts: 1 } })
    expect(result.isRetryableError).toBe(DEFAULT_RESILIENCE_CONFIG.isRetryableError)
  })

  it('should handle empty config object', () => {
    const result = resolveResilienceConfig({})
    expect(result.retry).toEqual(DEFAULT_RESILIENCE_CONFIG.retry)
    expect(result.backoff).toEqual(DEFAULT_RESILIENCE_CONFIG.backoff)
    expect(result.timeout).toEqual(DEFAULT_RESILIENCE_CONFIG.timeout)
  })
})

describe('DEFAULT_RESILIENCE_CONFIG', () => {
  it('should have retry with maxAttempts 2 and transient retryOn', () => {
    expect(DEFAULT_RESILIENCE_CONFIG.retry).toEqual({ maxAttempts: 2, retryOn: 'transient' })
  })

  it('should have exponential backoff with jitter', () => {
    expect(DEFAULT_RESILIENCE_CONFIG.backoff).toEqual({
      strategy: 'exponential',
      baseDelayMs: 500,
      maxDelayMs: 30_000,
      jitter: true,
    })
  })

  it('should have undefined timeouts by default', () => {
    expect(DEFAULT_RESILIENCE_CONFIG.timeout).toEqual({
      requestTimeoutMs: undefined,
      totalTimeoutMs: undefined,
    })
  })

  describe('default isRetryableError', () => {
    const classify = DEFAULT_RESILIENCE_CONFIG.isRetryableError

    it('should classify ECONNRESET as retryable', () => {
      expect(classify(new Error('ECONNRESET'))).toBe(true)
    })

    it('should classify ECONNREFUSED as retryable', () => {
      expect(classify(new Error('ECONNREFUSED'))).toBe(true)
    })

    it('should classify ETIMEDOUT as retryable', () => {
      expect(classify(new Error('ETIMEDOUT'))).toBe(true)
    })

    it('should classify rate limit messages as retryable', () => {
      expect(classify(new Error('Rate limit exceeded'))).toBe(true)
      expect(classify(new Error('Too many requests'))).toBe(true)
      expect(classify(new Error('Request throttled'))).toBe(true)
    })

    it('should classify timeout messages as retryable', () => {
      expect(classify(new Error('Request timeout'))).toBe(true)
    })

    it('should NOT classify AbortError as retryable', () => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      expect(classify(err)).toBe(false)
    })

    it('should NOT classify TimeoutError as retryable', () => {
      const err = new Error('timeout')
      err.name = 'TimeoutError'
      expect(classify(err)).toBe(false)
    })

    it('should classify HTTP 429 status code as retryable', () => {
      const err = Object.assign(new Error('error'), { status: 429 })
      expect(classify(err)).toBe(true)
    })

    it('should classify HTTP 503 status code as retryable', () => {
      const err = Object.assign(new Error('error'), { statusCode: 503 })
      expect(classify(err)).toBe(true)
    })

    it('should classify AWS SDK 429 metadata as retryable', () => {
      const err = Object.assign(new Error('error'), { $metadata: { httpStatusCode: 429 } })
      expect(classify(err)).toBe(true)
    })

    it('should NOT classify HTTP 401 as retryable', () => {
      const err = Object.assign(new Error('error'), { status: 401 })
      expect(classify(err)).toBe(false)
    })

    it('should NOT classify HTTP 400 as retryable', () => {
      const err = Object.assign(new Error('error'), { status: 400 })
      expect(classify(err)).toBe(false)
    })

    it('should NOT classify HTTP 404 as retryable', () => {
      const err = Object.assign(new Error('error'), { status: 404 })
      expect(classify(err)).toBe(false)
    })

    it('should NOT classify generic errors as retryable', () => {
      expect(classify(new Error('Something went wrong'))).toBe(false)
    })
  })
})
