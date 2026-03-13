export interface ProviderConfig {
  providers: string[]
  primaryProvider: string
  openaiApiKey?: string
  bedrockAuthMode?: 'profile' | 'keys'
  awsProfile?: string
  awsAccessKeyId?: string
  awsSecretAccessKey?: string
  awsRegion?: string
}

export const PROVIDER_META: Record<string, { label: string; importPath: string; factory: string; models: string[] }> = {
  openai: {
    label: 'OpenAI',
    importPath: '@genui-a3/providers/openai',
    factory: 'createOpenAIProvider',
    models: ['gpt-4o', 'gpt-4o-mini'],
  },
  bedrock: {
    label: 'AWS Bedrock',
    importPath: '@genui-a3/providers/bedrock',
    factory: 'createBedrockProvider',
    models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'us.anthropic.claude-haiku-4-5-20251001-v1:0'],
  },
}
