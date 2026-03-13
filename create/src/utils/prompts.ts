import * as p from '@clack/prompts'

import { detectAwsProfileRegion, detectAwsProfiles } from './aws'
import { PROVIDER_META, type ProviderConfig } from './providers'

function handleCancel<T>(value: T | symbol): asserts value is T {
  if (p.isCancel(value)) {
    p.cancel('Setup cancelled.')
    process.exit(1)
  }
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
    projectName = value
  }

  return projectName
}

async function promptAccessKeys(config: ProviderConfig): Promise<void> {
  p.log.info('You\'ll need AWS access keys to authenticate with Bedrock.\n  Create or manage keys at: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html')
  const awsAccessKeyId = await p.text({
    message: 'AWS_ACCESS_KEY_ID:',
    validate(input) {
      if (!input) return 'Access key ID is required.'
    },
  })
  handleCancel(awsAccessKeyId)
  config.awsAccessKeyId = awsAccessKeyId

  const awsSecretAccessKey = await p.password({
    message: 'AWS_SECRET_ACCESS_KEY:',
    validate(input) {
      if (!input) return 'Secret access key is required.'
    },
  })
  handleCancel(awsSecretAccessKey)
  config.awsSecretAccessKey = awsSecretAccessKey
}

async function promptOpenAIConfig(config: ProviderConfig): Promise<void> {
  p.log.step(PROVIDER_META.openai.label)
  const openaiApiKey = await p.text({
    message: 'OpenAI API key:',
    placeholder: 'sk-...',
    validate(input) {
      if (!input) return 'API key is required. Get one at https://platform.openai.com/api-keys'
    },
  })
  handleCancel(openaiApiKey)
  config.openaiApiKey = openaiApiKey
}

async function promptAnthropicConfig(config: ProviderConfig): Promise<void> {
  p.log.step(PROVIDER_META.anthropic.label)
  const anthropicApiKey = await p.text({
    message: 'Anthropic API key:',
    placeholder: 'sk-ant-...',
    validate(input) {
      if (!input) return 'API key is required. Get one at https://console.anthropic.com/settings/keys'
    },
  })
  handleCancel(anthropicApiKey)
  config.anthropicApiKey = anthropicApiKey
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
    const detectedProfiles = detectAwsProfiles()

    let selectedProfile: string = ''
    if (detectedProfiles.length > 0) {
      const MANUAL_ENTRY = '__manual__'
      const awsProfile = await p.select({
        message: 'AWS profile',
        options: [
          ...detectedProfiles.map((prof) => ({ label: prof, value: prof })),
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
        selectedProfile = manualProfile
      } else {
        selectedProfile = awsProfile
      }
    } else {
      p.log.warn('No AWS profiles found in ~/.aws/credentials')

      const noProfileAction = await p.select({
        message: 'How would you like to proceed?',
        options: [
          { label: 'Enter a profile name', value: 'manual' as const, hint: 'Configure the profile later with: aws configure --profile <name>' },
          { label: 'Use access keys instead', value: 'keys' as const, hint: 'Provide key ID + secret directly' },
        ],
      })
      handleCancel(noProfileAction)

      if (noProfileAction === 'manual') {
        const awsProfile = await p.text({
          message: 'AWS profile name:',
          placeholder: 'default',
          defaultValue: 'default',
          validate(input) {
            if (!input) return 'Profile name is required.'
          },
        })
        handleCancel(awsProfile)
        selectedProfile = awsProfile
      } else {
        config.bedrockAuthMode = 'keys'
        await promptAccessKeys(config)
      }
    }

    if (config.bedrockAuthMode === 'profile') {
      config.awsProfile = selectedProfile
    }
  } else {
    await promptAccessKeys(config)
  }

  const detectedRegion = config.bedrockAuthMode === 'profile'
    ? detectAwsProfileRegion(config.awsProfile!)
    : undefined

  const awsRegion = await p.text({
    message: 'AWS region:',
    ...(detectedRegion
      ? { initialValue: detectedRegion }
      : { placeholder: 'us-east-1' }),
    validate(input) {
      if (!input) return 'AWS region is required.'
    },
  })
  handleCancel(awsRegion)
  config.awsRegion = awsRegion
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
