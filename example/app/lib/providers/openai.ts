import { createOpenAIProvider } from '@genui-a3/providers/openai'

let _instance: ReturnType<typeof createOpenAIProvider> | null = null

export function getOpenAIProvider() {
  if (!_instance) {
    _instance = createOpenAIProvider({ models: ['gpt-4o', 'gpt-4o-mini'] })
  }
  return _instance
}
