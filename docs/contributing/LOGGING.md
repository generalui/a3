# Logging

A3 uses [LogLayer](https://loglayer.dev) as its logging abstraction and [tslog](https://tslog.js.org) as the default output backend.

## For package users

If you want A3's logs to flow through your own logging infrastructure, see [Custom Logging](../CUSTOM_LOGGING.md).

---

## Architecture

### The `log` singleton

All logging within the A3 package is done through a single `log` object exported from `src/utils/logger/`.

```typescript
import { log } from '@utils/logger'
```

Internally, `log` is a JavaScript `Proxy` that delegates every property access to `getLogger()` at call time.
This means:

- Any file can import `log` once at the top and use it directly — no need to call `getLogger()` at each use site.
- If a user calls `configureLogger()` at application startup (before the first log statement fires), the new logger takes effect automatically.
  The `log` reference does not need to be re-imported.

### `getLogger()` and `configureLogger()`

- `getLogger()` — lazily initialises and returns the active [`ILogLayer`](https://loglayer.dev) instance.
  On first call, if no custom logger has been set, it creates the default tslog-backed logger.
- `configureLogger(logger: ILogLayer)` — replaces the active logger.
  Should be called once at application startup, before any `ChatSession` is created.

Both are exported from `@genui/a3` as part of the public API.

### Default logger

The default logger is a `LogLayer` instance wrapping a `tslog` transport:

- Pretty, human-readable output when `NODE_ENV !== 'production'`
- Structured JSON output when `NODE_ENV === 'production'`
- Log level controlled by the `A3_LOG_LEVEL` environment variable (default: `info`)

---

## Adding logs in A3 code

Import `log` and use the [LogLayer API](https://loglayer.dev):

```typescript
import { log } from '@utils/logger'

// Basic logging
log.info('Hello world!')

// Logging with metadata (attached to this log entry only)
log.withMetadata({ agentId: 'greeting', sessionId: 'abc' }).debug('Agent selected')

// Logging with context (persists across subsequent log calls on this instance)
log.withContext({ sessionId: 'abc' })
log.info('Processing request')

// Logging errors
log.withError(new Error('Something went wrong')).error('Failed to process request')
```

For the full LogLayer API — including `withPrefix`, child loggers, plugins, and multi-transport — see the [LogLayer documentation](https://loglayer.dev).

### ⚠️ `withContext()` and shared server state

`log` is a module-level singleton shared across all requests in a running process.
`withContext()` mutates the logger instance and **persists across all subsequent log calls** — including those from other users' requests on the same pod.

Use `withMetadata()` for any request-scoped data (agentId, sessionId, etc.).
It applies only to the single log call it's chained on.

```typescript
// ✅ Safe — applies to this log call only
log.withMetadata({ agentId: 'greeting', sessionId: 'abc' }).debug('Agent selected')

// ❌ Dangerous in a server — persists on the shared instance across all requests
log.withContext({ sessionId: 'abc' })
```

---

## Log levels

The `A3_LOG_LEVEL` environment variable accepts the following values (lowest to highest):

`silly` → `trace` → `debug` → `info` _(default)_ → `warn` → `error` → `fatal`

```bash
A3_LOG_LEVEL=debug node your-app.js
```

---

## Key files

- `src/utils/logger/index.ts` — logger module: `log`, `getLogger()`, `configureLogger()`, default tslog setup
- `src/index.ts` — public exports: `configureLogger`, `getLogger`, `ILogLayer`
- `jest.setup.ts` — global Jest mock for `@utils/logger` (replaces `log` with a mock object in tests)
