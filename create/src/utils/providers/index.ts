import providersMeta from '@create-utils/providers/providersMeta.json'

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

interface ProviderMeta {
  label: string
  exportName: string
  file: string
  npmPackage: string
  envVar?: string
  urls: {
    keys: string
    configure?: string
    credentials?: string
    docs?: string
  }
}

export const PROVIDER_META: Record<string, ProviderMeta> = providersMeta

/**
 * Returns the docs filename for a provider key.
 * e.g. 'openai' → 'PROVIDER-OPENAI.md'
 */
export function providerDocName(key: string): string {
  return `PROVIDER-${key.toUpperCase()}.md`
}
