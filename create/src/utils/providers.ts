export interface ProviderConfig {
  providers: string[]
  primaryProvider: string
  openaiApiKey?: string
  anthropicApiKey?: string
  bedrockAuthMode?: 'profile' | 'keys'
  awsProfile?: string
  awsAccessKeyId?: string
  awsSecretAccessKey?: string
  awsRegion?: string
}

export const PROVIDER_META: Record<string, { label: string; exportName: string; file: string; npmPackage: string }> = {
  openai: { label: 'OpenAI', exportName: 'getOpenAIProvider', file: 'openai.ts', npmPackage: '@genui-a3/a3-openai' },
  bedrock: {
    label: 'AWS Bedrock',
    exportName: 'getBedrockProvider',
    file: 'bedrock.ts',
    npmPackage: '@genui-a3/a3-bedrock',
  },
  anthropic: {
    label: 'Anthropic',
    exportName: 'getAnthropicProvider',
    file: 'anthropic.ts',
    npmPackage: '@genui-a3/a3-anthropic',
  },
}
