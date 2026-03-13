import { createAnthropicProvider } from '@genui-a3/providers/anthropic'

let _instance: ReturnType<typeof createAnthropicProvider> | null = null

export function getAnthropicProvider() {
  if (!_instance) {
    _instance = createAnthropicProvider({
      models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
    })
  }
  return _instance
}
