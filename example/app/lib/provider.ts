import { createOpenAIProvider } from '@genui-a3/providers/openai'
import type { Provider } from '@genui-a3/core'

let _provider: Provider

export function getProvider(): Provider {
  if (!_provider) {
    _provider = createOpenAIProvider({
      models: ['gpt-4o', 'gpt-4o-mini'],
    })
  }
  return _provider
}
