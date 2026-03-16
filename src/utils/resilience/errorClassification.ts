/**
 * Determines whether an error is transient and safe to retry.
 *
 * Checks HTTP status codes, error message patterns, and AWS SDK metadata.
 * Returns `false` for intentional cancellation (AbortError/TimeoutError).
 *
 * @param error - The error to classify
 * @returns `true` if the error is retryable
 */
export function isRetryableError(error: Error): boolean {
  // Intentional cancellation — NOT retryable
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return false
  }

  const message = error.message.toLowerCase()

  // Network errors
  if (/econnreset|econnrefused|econnaborted|etimedout|enetunreach|epipe|ehostunreach/.test(message)) {
    return true
  }

  // Throttling / rate-limit patterns
  if (/throttl|rate.?limit|too many requests|request.?limit|quota/.test(message)) {
    return true
  }

  // Timeout patterns (but not AbortError — already handled above)
  if (/timeout|timed?\s*out/.test(message)) {
    return true
  }

  // HTTP status code extraction
  const status = extractStatusCode(error)
  if (status !== undefined) {
    return isRetryableStatusCode(status)
  }

  return false
}

function extractStatusCode(error: Error): number | undefined {
  const err = error as unknown as Record<string, unknown>

  // AWS SDK v3 metadata
  if (err.$metadata && typeof err.$metadata === 'object') {
    const meta = err.$metadata as Record<string, unknown>
    if (typeof meta.httpStatusCode === 'number') return meta.httpStatusCode
  }

  // Generic status / statusCode properties
  if (typeof err.status === 'number') return err.status
  if (typeof err.statusCode === 'number') return err.statusCode

  return undefined
}

function isRetryableStatusCode(status: number): boolean {
  // 408 Request Timeout, 429 Too Many Requests, 500+ Server Errors (includes 529 Overloaded)
  return status === 408 || status === 429 || status >= 500
}
