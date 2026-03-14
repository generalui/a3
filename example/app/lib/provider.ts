import { createAnthropicProvider } from '@genui-a3/providers/anthropic'
import type { Provider } from '@genui-a3/core'

let _provider: Provider

export function getProvider(): Provider {
  if (!_provider) {
    _provider = createAnthropicProvider({
      models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    })
  }
  return _provider
}
