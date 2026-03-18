import { createAnthropicProvider } from '@genui-a3/a3-anthropic'

let _instance: ReturnType<typeof createAnthropicProvider> | null = null

export function getAnthropicProvider() {
  if (!_instance) {
    _instance = createAnthropicProvider({
      models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    })
  }
  return _instance
}
