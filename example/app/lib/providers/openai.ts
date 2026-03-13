import { createOpenAIProvider } from '@genui-a3/providers/openai'

export const openaiProvider = createOpenAIProvider({ models: ['gpt-4o', 'gpt-4o-mini'] })
