import { createBedrockProvider } from '@genui-a3/a3-bedrock'

let _instance: ReturnType<typeof createBedrockProvider> | null = null

export function getBedrockProvider() {
  if (!_instance) {
    _instance = createBedrockProvider({
      models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'us.anthropic.claude-haiku-4-5-20251001-v1:0'],
    })
  }
  return _instance
}
