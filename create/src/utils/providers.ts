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
  openai: { label: 'OpenAI', exportName: 'openaiProvider', file: 'openai.ts' },
  bedrock: { label: 'AWS Bedrock', exportName: 'bedrockProvider', file: 'bedrock.ts' },
  anthropic: { label: 'Anthropic', exportName: 'anthropicProvider', file: 'anthropic.ts' },
}
