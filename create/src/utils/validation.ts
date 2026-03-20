interface ValidationResult {
  valid: boolean
  message: string
}

/**
 * Normalize API/credential keys by removing all whitespace
 * @example normalizeKey('sk-proj-abc\n123') → 'sk-proj-abc123'
 */
export function normalizeKey(key: string): string {
  return key.replace(/\s/g, '')
}

import providersMeta from './providers/providersMeta.json'

function buildErrorMessage({
  detail,
  provider,
  helpUrl,
}: {
  detail: string
  provider: string
  helpUrl?: string
}): string {
  let message =
    `${provider} API key error: ${detail}` +
    '\n\nMake sure:\n  • Your credentials are active and not revoked' +
    '\n  • Your account has appropriate permissions' +
    "\n  • The credentials haven't exceeded rate limits"

  if (helpUrl) {
    message += `\n\nGet help at: ${helpUrl}`
  }

  return message
}

export async function validateOpenAIKey(apiKey: string): Promise<ValidationResult> {
  if (!apiKey.startsWith('sk-proj-')) {
    return {
      valid: false,
      message: `Invalid format: OpenAI API key must start with sk-proj-\n\nGet a new key at: ${providersMeta.openai.urls.keys}`,
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (response.ok) {
      return { valid: true, message: 'OpenAI API key verified — completions working.' }
    }

    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    const detail = body?.error?.message ?? `HTTP ${response.status}`
    return { valid: false, message: buildErrorMessage({ detail, provider: 'OpenAI' }) }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { valid: false, message: `Network error: ${msg}` }
  }
}

export async function validateAnthropicKey(apiKey: string): Promise<ValidationResult> {
  if (!apiKey.startsWith('sk-ant-')) {
    return {
      valid: false,
      message: `Invalid format: Anthropic API key must start with sk-ant-\n\nGet a new key at: ${providersMeta.anthropic.urls.keys}`,
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (response.ok) {
      return { valid: true, message: 'Anthropic API key verified — completions working.' }
    }

    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    const detail = body?.error?.message ?? `HTTP ${response.status}`
    return {
      valid: false,
      message: buildErrorMessage({ detail, provider: 'Anthropic', helpUrl: providersMeta.anthropic.urls.keys }),
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { valid: false, message: `Network error: ${msg}` }
  }
}

type AwsCredentialInput =
  | { mode: 'profile'; profile: string; region: string }
  | { mode: 'keys'; accessKeyId: string; secretAccessKey: string; region: string }

export async function validateAwsCredentials(credentials: AwsCredentialInput): Promise<ValidationResult> {
  // Format validation for key-based authentication (quick, no API call)
  if (credentials.mode === 'keys') {
    if (!credentials.accessKeyId.match(/^AKIA[0-9A-Z]{16}$/)) {
      return {
        valid: false,
        message: `Invalid format: AWS Access Key ID must start with AKIA and be 20 characters total\n\nManage keys at: ${providersMeta.bedrock.urls.keys}`,
      }
    }
    if (credentials.secretAccessKey.length < 40) {
      return {
        valid: false,
        message: `Invalid format: AWS Secret Access Key appears too short (should be ~40 characters)\n\nManage keys at: ${providersMeta.bedrock.urls.keys}`,
      }
    }
  }

  try {
    const { BedrockClient, ListFoundationModelsCommand } = await import('@aws-sdk/client-bedrock')

    let clientConfig: ConstructorParameters<typeof BedrockClient>[0]

    if (credentials.mode === 'profile') {
      const { fromIni } = await import('@aws-sdk/credential-provider-ini')
      clientConfig = {
        region: credentials.region,
        credentials: fromIni({ profile: credentials.profile }),
      }
    } else {
      clientConfig = {
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      }
    }

    const client = new BedrockClient(clientConfig)
    await client.send(new ListFoundationModelsCommand({ byOutputModality: 'TEXT' }))

    return { valid: true, message: 'AWS credentials verified with Bedrock access.' }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    let message = `AWS validation failed: ${msg}`

    // Provide context for common errors
    if (msg.includes('Could not resolve credentials')) {
      const profile = credentials.mode === 'profile' ? credentials.profile : 'unknown'
      message =
        `Could not find credentials for profile "${profile}" in ~/.aws/credentials` +
        '\n\nSet up a profile with: aws configure' +
        `\n  Guide: ${providersMeta.bedrock.urls.configure}`
    } else if (msg.includes('InvalidSignatureException') || msg.includes('InvalidSignature')) {
      message =
        "Invalid AWS credentials (signature mismatch)\n\nMake sure:\n  • Your Access Key ID and Secret Access Key are correct\n  • They haven't been revoked or rotated" +
        `\n\nManage credentials at: ${providersMeta.bedrock.urls.credentials}`
    } else if (msg.includes('UnauthorizedOperation') || msg.includes('NotAuthorizedForSourceException')) {
      message =
        "AWS credentials don't have permission to access Bedrock\n\nMake sure:\n  • Your IAM user/role has Bedrock access\n  • Your region has Bedrock enabled" +
        `\n\nLearn more: ${providersMeta.bedrock.urls.docs}`
    }

    return { valid: false, message }
  }
}
