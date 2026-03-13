import { createAnthropicProvider } from '@genui-a3/providers/anthropic'

export const anthropicProvider = createAnthropicProvider({
  models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
})
