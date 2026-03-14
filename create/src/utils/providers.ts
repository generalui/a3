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

export const PROVIDER_META: Record<string, { label: string; exportName: string; file: string }> = {
  openai: { label: 'OpenAI', exportName: 'getOpenAIProvider', file: 'openai.ts' },
  bedrock: { label: 'AWS Bedrock', exportName: 'getBedrockProvider', file: 'bedrock.ts' },
  anthropic: { label: 'Anthropic', exportName: 'getAnthropicProvider', file: 'anthropic.ts' },
}
