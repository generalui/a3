# Custom Logging

By default, A3 logs internally using [tslog](https://tslog.js.org) with no configuration required.
If you want A3's internal logs to flow through your own logging infrastructure — for example, to include your app's trace IDs, ship logs to a provider like Datadog or OpenTelemetry, or change the output format — you can provide a custom logger.

## How it works

A3 uses [LogLayer](https://loglayer.dev) as its logging interface.
LogLayer is a transport-agnostic logging layer: you configure it with a _transport_ that wraps your preferred logging library, and LogLayer routes A3's log calls through it.

You do not need to know the LogLayer API to use your own logger — you only need to wrap it in the appropriate LogLayer transport.

## Default behaviour

Out of the box, A3:

- Outputs pretty, human-readable logs in development (`NODE_ENV !== 'production'`)
- Outputs structured JSON in production
- Defaults to log level `info`, overridden by the `A3_LOG_LEVEL` environment variable

```bash
# Supported levels: silly | trace | debug | info | warn | error | fatal
A3_LOG_LEVEL=debug node your-app.js
```

## Configuring a custom logger

A3 uses the [LogLayer](https://loglayer.dev) interface.
Call `configureLogger()` with a `LogLayer` instance configured for your preferred logging library.
See the [LogLayer documentation](https://loglayer.dev) for setup instructions and the full list of available transports.

## Further reading

- [LogLayer documentation](https://loglayer.dev) — full API, plugins, multi-transport, context, and more
- [LogLayer transports](https://loglayer.dev/transports) — all available transports with setup instructions
- [tslog documentation](https://tslog.js.org) — the default A3 logger
