import { isRetryableError } from '../../../../../src/utils/resilience/errorClassification'

jest.unmock('../../../../../src/utils/resilience/errorClassification')

describe('isRetryableError', () => {
  describe('retryable errors', () => {
    it.each([
      ['HTTP 408 (Request Timeout)', Object.assign(new Error('timeout'), { status: 408 })],
      ['HTTP 429 (Too Many Requests)', Object.assign(new Error('rate limited'), { status: 429 })],
      ['HTTP 500 (Internal Server Error)', Object.assign(new Error('server error'), { status: 500 })],
      ['HTTP 502 (Bad Gateway)', Object.assign(new Error('bad gateway'), { status: 502 })],
      ['HTTP 503 (Service Unavailable)', Object.assign(new Error('unavailable'), { status: 503 })],
      ['HTTP 504 (Gateway Timeout)', Object.assign(new Error('gateway timeout'), { status: 504 })],
      ['HTTP 529 (Overloaded)', Object.assign(new Error('overloaded'), { status: 529 })],
      ['ECONNRESET', new Error('ECONNRESET')],
      ['ECONNREFUSED', new Error('ECONNREFUSED')],
      ['ECONNABORTED', new Error('ECONNABORTED')],
      ['ETIMEDOUT', new Error('ETIMEDOUT')],
      ['throttling messages', new Error('Request throttled by service')],
      ['rate limit messages', new Error('Rate limit exceeded')],
      ['rate limit messages (Too many requests)', new Error('Too many requests')],
      ['AWS SDK $metadata.httpStatusCode', Object.assign(new Error('throttling'), { $metadata: { httpStatusCode: 429 } })],
      ['statusCode property', Object.assign(new Error('error'), { statusCode: 503 })],
    ])('should classify %s as retryable', (_name, err) => {
      expect(isRetryableError(err)).toBe(true)
    })
  })

  describe('non-retryable errors', () => {
    it.each([
      ['HTTP 400 (Bad Request)', Object.assign(new Error('bad request'), { status: 400 })],
      ['HTTP 401 (Unauthorized)', Object.assign(new Error('unauthorized'), { status: 401 })],
      ['HTTP 403 (Forbidden)', Object.assign(new Error('forbidden'), { status: 403 })],
      ['HTTP 404 (Not Found)', Object.assign(new Error('not found'), { status: 404 })],
      ['AbortError', Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })],
      ['TimeoutError (intentional)', Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' })],
      ['generic errors (Something went wrong)', new Error('Something went wrong')],
      ['generic errors (Invalid JSON)', new Error('Invalid JSON')],
    ])('should NOT classify %s as retryable', (_name, err) => {
      expect(isRetryableError(err)).toBe(false)
    })
  })
})
