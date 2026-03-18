# Resilience

A3 providers include built-in resilience: automatic retries with backoff, per-request and total timeouts, and model fallback.
When a request fails, the provider retries against the same model before falling back to the next model in your list — all with zero configuration required.

## How it works

When you call `sendRequest` or `sendRequestStream`, the provider delegates to `executeWithFallback`, which runs this loop:

```text
for each model (in priority order):
  for each attempt (1 … 1 + maxAttempts):
    1. Check total timeout — abort if exceeded
    2. Build an AbortSignal combining per-request timeout + total timeout
    3. Call the provider action with (model, signal)
    4. On success → return result
    5. On failure:
       a. Record the error
       b. If retryable and attempts remain → backoff delay → retry same model
       c. Otherwise → move to next model

All models exhausted → throw A3ResilienceError
Total timeout exceeded → throw A3TimeoutError
```

## Defaults

With zero configuration, every provider gets:

| Setting | Default |
|---|---|
| `retry.maxAttempts` | `2` (3 total attempts per model) |
| `retry.retryOn` | `'transient'` |
| `backoff.strategy` | `'exponential'` |
| `backoff.baseDelayMs` | `500` |
| `backoff.maxDelayMs` | `30000` |
| `backoff.jitter` | `true` |
| `timeout.requestTimeoutMs` | `undefined` (SDK default) |
| `timeout.totalTimeoutMs` | `undefined` (no limit) |
| `isRetryableError` | Built-in classifier |

These defaults are exported as `DEFAULT_RESILIENCE_CONFIG` from `@genui/a3`.

## Configuration examples

Pass a `resilience` object when creating a provider.
All fields are optional — unspecified fields keep their defaults.

### Minimal — just increase retries

```typescript
const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
  resilience: {
    retry: { maxAttempts: 3 },
  },
})
```

### Medium — linear backoff with timeouts

```typescript
const provider = createOpenAIProvider({
  models: ['gpt-4o', 'gpt-4o-mini'],
  resilience: {
    retry: { maxAttempts: 2 },
    backoff: { strategy: 'linear', baseDelayMs: 1000 },
    timeout: {
      requestTimeoutMs: 30_000,
      totalTimeoutMs: 90_000,
    },
  },
})
```

### Maximum — full control

```typescript
const provider = createBedrockProvider({
  models: [
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  ],
  resilience: {
    retry: { maxAttempts: 5, retryOn: 'all' },
    backoff: {
      strategy: 'exponential',
      baseDelayMs: 200,
      maxDelayMs: 10_000,
      jitter: true,
    },
    timeout: {
      requestTimeoutMs: 15_000,
      totalTimeoutMs: 120_000,
    },
    isRetryableError: (error) => {
      // Custom logic — retry everything except auth errors
      return !error.message.includes('401')
    },
  },
})
```

### Disable retries entirely

```typescript
const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
  resilience: {
    retry: false,
  },
})
```

With `retry: false`, each model is attempted exactly once with no backoff.
Model fallback still applies if you provide multiple models.

## Backoff strategies

| Strategy | Formula | Example (baseDelay=500ms) |
|---|---|---|
| `'exponential'` (default) | `baseDelay * 2^attempt` | 500ms, 1000ms, 2000ms, 4000ms… |
| `'linear'` | `baseDelay * (attempt + 1)` | 500ms, 1000ms, 1500ms, 2000ms… |
| `'fixed'` | `baseDelay` | 500ms, 500ms, 500ms, 500ms… |

All strategies are capped at `maxDelayMs`.
When `jitter` is `true`, the actual delay is randomized between `0` and the calculated value.

## Error classification

The built-in `isRetryableError` classifier determines which errors are transient (safe to retry) and which are permanent (skip to next model).

**Retryable (transient):**

- Network errors: `ECONNRESET`, `ECONNREFUSED`, `ECONNABORTED`, `ETIMEDOUT`, `ENETUNREACH`, `EPIPE`, `EHOSTUNREACH`
- Throttling: messages containing `throttl`, `rate limit`, `too many requests`, `request limit`, `quota`
- Timeouts: messages containing `timeout` or `timed out`
- HTTP status codes: `408` (Request Timeout), `429` (Too Many Requests), `500+` (Server Errors, including `529` Overloaded)
- AWS SDK v3: reads `$metadata.httpStatusCode` automatically

**Not retryable:**

- `AbortError` / `TimeoutError` (intentional cancellation by the timeout system)
- `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found
- Any error not matching the patterns above

When `retryOn` is set to `'all'`, the classifier is bypassed and every error triggers a retry (up to `maxAttempts`).

## Error handling

When all models and retries are exhausted, A3 throws typed errors that preserve the full failure history.

### A3ResilienceError

Thrown when every model has failed.
Contains an `errors` array with one entry per failed attempt.

```typescript
import { A3ResilienceError } from '@genui/a3'

try {
  await provider.sendRequest(request)
} catch (err) {
  if (err instanceof A3ResilienceError) {
    for (const entry of err.errors) {
      console.log(`${entry.model} attempt ${entry.attempt}: ${entry.error.message}`)
    }
  }
}
```

Each `ResilienceErrorEntry` contains:

- `model` — the model identifier that was attempted
- `attempt` — 1-based attempt number within that model's retry cycle
- `error` — the original `Error` object

### A3TimeoutError

Thrown when `totalTimeoutMs` is exceeded.
Extends `A3ResilienceError`, so it includes the same `errors` array and can be caught by either type.

```typescript
import { A3TimeoutError, A3ResilienceError } from '@genui/a3'

try {
  await provider.sendRequest(request)
} catch (err) {
  if (err instanceof A3TimeoutError) {
    console.log('Total timeout exceeded')
  } else if (err instanceof A3ResilienceError) {
    console.log('All models exhausted')
  }
}
```

## Custom error classifier

Override the built-in classification by providing an `isRetryableError` function.
When provided, this replaces the default classifier entirely.

```typescript
const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'],
  resilience: {
    isRetryableError: (error) => {
      // Only retry rate-limit errors
      return error.message.includes('429') || error.message.includes('Too Many Requests')
    },
  },
})
```

The custom classifier is ignored when `retryOn` is set to `'all'`.

## Key files

| File | Description |
|---|---|
| `src/types/resilience.ts` | `ResilienceConfig`, `RetryConfig`, `BackoffConfig`, `TimeoutConfig`, `ResolvedResilienceConfig` |
| `src/utils/resilience/defaults.ts` | `DEFAULT_RESILIENCE_CONFIG`, `resolveResilienceConfig()` |
| `src/utils/resilience/errorClassification.ts` | `isRetryableError()` — built-in error classifier |
| `src/errors/resilience.ts` | `A3ResilienceError`, `A3TimeoutError`, `ResilienceErrorEntry` |
| `providers/utils/executeWithFallback.ts` | `executeWithFallback()` — core execution loop |
| `providers/utils/backoff.ts` | `calculateBackoff()`, `sleep()` |
| `src/index.ts` | Public exports: `resolveResilienceConfig`, `DEFAULT_RESILIENCE_CONFIG`, `isRetryableError`, `A3ResilienceError`, `A3TimeoutError` |
