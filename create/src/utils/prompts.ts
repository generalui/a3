import * as p from '@clack/prompts'

import { detectAwsProfileRegion, detectAwsProfiles } from '@create-utils/aws'
import { PROVIDER_META, type ProviderConfig } from '@create-utils/providers'
import { maskedInput } from '@create-utils/maskedInput'
import { maskKey, normalizeKey, validateAnthropicKey, validateAwsCredentials, validateOpenAIKey } from '@create-utils/validation'

function handleCancel<T>(value: T | symbol): asserts value is T {
  if (p.isCancel(value)) {
    p.cancel('Setup cancelled.')
    process.exit(1)
  }
}

interface ApiKeyConfig {
  providerKey: string
  configField: keyof ProviderConfig
  validateFn: (key: string) => Promise<{ valid: boolean; message: string }>
}

const API_KEY_CONFIGS: Record<string, ApiKeyConfig> = {
  openai: { providerKey: 'openai', configField: 'openaiApiKey', validateFn: validateOpenAIKey },
  anthropic: { providerKey: 'anthropic', configField: 'anthropicApiKey', validateFn: validateAnthropicKey },
}

export async function promptProjectName(): Promise<string> {
  let projectName = process.argv[2]

  if (!projectName) {
    const value = await p.text({
      message: 'What is your project named?',
      placeholder: 'my-a3-quickstart',
      defaultValue: 'my-a3-quickstart',
    })
    handleCancel(value)
    projectName = value.trim()
  }

  return projectName
}

async function promptAccessKeys(config: ProviderConfig): Promise<void> {
  p.log.info(
    "You'll need AWS access keys to authenticate with Bedrock.\n  Create or manage keys at: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
  )
  const awsAccessKeyId = await p.text({
    message: 'AWS_ACCESS_KEY_ID:',
    validate(input) {
      if (!input) return 'Access key ID is required.'
    },
  })
  handleCancel(awsAccessKeyId)
  config.awsAccessKeyId = normalizeKey(awsAccessKeyId)

  const awsSecretAccessKey = await maskedInput({
    message: 'AWS_SECRET_ACCESS_KEY:',
    edge: 4,
    validate(input) {
      if (!input) return 'Secret access key is required.'
    },
  })
  handleCancel(awsSecretAccessKey)
  config.awsSecretAccessKey = normalizeKey(awsSecretAccessKey)
}

async function promptManualKeyEntry(config: ProviderConfig, cfg: ApiKeyConfig): Promise<void> {
  const meta = PROVIDER_META[cfg.providerKey]
  let validated = false
  while (!validated) {
    const apiKey = await maskedInput({
      message: `${meta.label} API key:`,
      validate(input) {
        if (!input) return `API key is required. Get one at ${meta.urls.keys}`
      },
    })
    handleCancel(apiKey)
    config[cfg.configField] = normalizeKey(apiKey) as never

    const spin = p.spinner()
    spin.start(`Validating ${meta.label} credentials...`)
    const result = await cfg.validateFn(config[cfg.configField] as string)
    spin.stop(result.valid ? `${meta.label} credentials verified` : `${meta.label} validation failed`)

    if (result.valid) {
      validated = true
    } else {
      p.log.warn(result.message)
      p.log.info('Please try again.')
    }
  }
}

async function promptApiKeyConfig(config: ProviderConfig, cfg: ApiKeyConfig): Promise<void> {
  const meta = PROVIDER_META[cfg.providerKey]
  p.log.step(meta.label)

  const envValue = meta.envVar ? process.env[meta.envVar] : undefined

  if (envValue) {
    const normalized = normalizeKey(envValue)
    const masked = maskKey(normalized)
    p.log.info(`Detected ${meta.envVar}: ${masked}`)

    const action = await p.select({
      message: 'Use detected key?',
      options: [
        { label: 'Use detected key', value: 'use' as const },
        { label: 'Enter manually', value: 'manual' as const },
      ],
    })
    handleCancel(action)

    if (action === 'use') {
      const spin = p.spinner()
      spin.start(`Validating ${meta.label} credentials...`)
      const result = await cfg.validateFn(normalized)
      spin.stop(result.valid ? `${meta.label} credentials verified` : `${meta.label} validation failed`)

      if (result.valid) {
        config[cfg.configField] = normalized as never
        return
      }

      p.log.warn(result.message)
      p.log.info('Falling back to manual entry.')
    }
  }

  await promptManualKeyEntry(config, cfg)
}

async function promptOpenAIConfig(config: ProviderConfig): Promise<void> {
  await promptApiKeyConfig(config, API_KEY_CONFIGS.openai)
}

async function promptAnthropicConfig(config: ProviderConfig): Promise<void> {
  await promptApiKeyConfig(config, API_KEY_CONFIGS.anthropic)
}

async function promptProfileSelection(profiles: string[]): Promise<string> {
  const MANUAL_ENTRY = '__manual__'
  const awsProfile = await p.select({
    message: 'AWS profile',
    options: [
      ...profiles.map((prof) => ({ label: prof, value: prof })),
      { label: 'Enter manually', value: MANUAL_ENTRY },
    ],
  })
  handleCancel(awsProfile)

  if (awsProfile === MANUAL_ENTRY) {
    const manualProfile = await p.text({
      message: 'AWS profile name:',
      placeholder: 'default',
      defaultValue: 'default',
      validate(input) {
        if (!input) return 'Profile name is required.'
      },
    })
    handleCancel(manualProfile)
    return manualProfile.trim()
  }

  return awsProfile
}

/**
 * Detect AWS profiles and prompt for selection, or offer fallback to access keys if none found.
 * @returns selected profile name, or null if the user switched to access keys
 */
async function promptDetectProfile(config: ProviderConfig): Promise<string | null> {
  const profiles = detectAwsProfiles()

  if (profiles.length > 0) {
    return promptProfileSelection(profiles)
  }

  while (true) {
    p.log.warn('No AWS profiles found in ~/.aws/credentials')
    p.log.info(
      'Set up a profile with: aws configure\n  Guide: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html',
    )

    const action = await p.select({
      message: 'How would you like to proceed?',
      options: [
        { label: 'Try again', value: 'retry' as const, hint: 'Re-check ~/.aws/credentials' },
        { label: 'Use access keys instead', value: 'keys' as const, hint: 'Provide key ID + secret directly' },
      ],
    })
    handleCancel(action)

    if (action === 'keys') {
      config.bedrockAuthMode = 'keys'
      await promptAccessKeys(config)
      return null
    }

    const retryProfiles = detectAwsProfiles()
    if (retryProfiles.length > 0) {
      return promptProfileSelection(retryProfiles)
    }
  }
}

async function promptBedrockConfig(config: ProviderConfig): Promise<void> {
  p.log.step(PROVIDER_META.bedrock.label)
  const authMode = await p.select({
    message: 'How do you want to authenticate with AWS Bedrock?',
    options: [
      { label: 'AWS Profile (recommended)', value: 'profile' as const, hint: 'Uses ~/.aws/credentials' },
      { label: 'Access Keys', value: 'keys' as const, hint: 'Provide key ID + secret directly' },
    ],
  })
  handleCancel(authMode)

  config.bedrockAuthMode = authMode

  if (authMode === 'profile') {
    const profile = await promptDetectProfile(config)
    if (profile) config.awsProfile = profile
  } else {
    await promptAccessKeys(config)
  }

  let validated = false
  let firstAttempt = true
  while (!validated) {
    if (!firstAttempt) {
      if (config.bedrockAuthMode === 'keys') {
        await promptAccessKeys(config)
      } else {
        const retryAction = await p.select({
          message: 'How would you like to retry?',
          options: [
            { label: 'Try a different profile', value: 'profile' as const },
            { label: 'Switch to access keys', value: 'keys' as const },
          ],
        })
        handleCancel(retryAction)

        if (retryAction === 'keys') {
          config.bedrockAuthMode = 'keys'
          await promptAccessKeys(config)
        } else {
          const profile = await promptDetectProfile(config)
          if (profile) config.awsProfile = profile
        }
      }
    }
    firstAttempt = false

    const currentDetectedRegion =
      config.bedrockAuthMode === 'profile' ? detectAwsProfileRegion(config.awsProfile!) : undefined

    const awsRegion = await p.text({
      message: 'AWS region:',
      ...(currentDetectedRegion ? { initialValue: currentDetectedRegion } : { placeholder: 'us-east-1' }),
      validate(input) {
        if (!input) return 'AWS region is required.'
      },
    })
    handleCancel(awsRegion)
    config.awsRegion = awsRegion.trim()

    const spin = p.spinner()
    spin.start('Validating AWS Bedrock credentials...')

    const credentialInput =
      config.bedrockAuthMode === 'profile'
        ? { mode: 'profile' as const, profile: config.awsProfile!, region: config.awsRegion }
        : {
            mode: 'keys' as const,
            accessKeyId: config.awsAccessKeyId!,
            secretAccessKey: config.awsSecretAccessKey!,
            region: config.awsRegion,
          }

    const result = await validateAwsCredentials(credentialInput)
    spin.stop(result.valid ? 'AWS Bedrock credentials verified' : 'AWS Bedrock validation failed')

    if (result.valid) {
      validated = true
    } else {
      p.log.warn(result.message)
      p.log.info('Re-entering credentials...')
    }
  }
}

async function promptPrimaryProvider(providers: string[], config: ProviderConfig): Promise<void> {
  const primaryProvider = await p.select({
    message: 'Which provider should the app use by default?',
    options: providers.map((prov) => ({ label: PROVIDER_META[prov].label, value: prov })),
  })
  handleCancel(primaryProvider)
  config.primaryProvider = primaryProvider
}

export async function promptProviders(): Promise<ProviderConfig> {
  const providers = await p.multiselect({
    message: 'Which LLM provider(s) do you want to configure?',
    options: [
      { label: 'OpenAI', value: 'openai' },
      { label: 'AWS Bedrock', value: 'bedrock' },
      { label: 'Anthropic', value: 'anthropic' },
    ],
    required: true,
  })
  handleCancel(providers)

  const config: ProviderConfig = {
    providers,
    primaryProvider: providers[0],
  }

  if (providers.includes('openai')) {
    await promptOpenAIConfig(config)
  }

  if (providers.includes('bedrock')) {
    await promptBedrockConfig(config)
  }

  if (providers.includes('anthropic')) {
    await promptAnthropicConfig(config)
  }

  if (providers.length > 1) {
    await promptPrimaryProvider(providers, config)
  }

  return config
}
