import { createBedrockProvider } from '@genui-a3/providers/bedrock'

export const bedrockProvider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'us.anthropic.claude-haiku-4-5-20251001-v1:0'],
})
