import chalk from 'chalk'
import prompts from 'prompts'

import { PROVIDER_META, type ProviderConfig } from './providers'

function onCancel(): never {
  console.log(chalk.red('\nSetup cancelled.'))
  process.exit(1)
}

/** Wrapper around `prompts` that auto-wires the cancel handler. */
function prompt<T extends string>(questions: prompts.PromptObject<T> | prompts.PromptObject<T>[]) {
  return prompts(questions, { onCancel })
}

export async function promptProjectName(): Promise<string> {
  let projectName = process.argv[2]

  if (!projectName) {
    const response = await prompt({ type: 'text', name: 'projectName', message: 'What is your project named?', initial: 'my-a3-quickstart' })
    projectName = response.projectName as string
  }

  if (!projectName) {
    console.error(chalk.red('Project name is required.'))
    process.exit(1)
  }

  return projectName
}

export async function promptProviders(): Promise<ProviderConfig> {
  const { providers } = (await prompt({
    type: 'multiselect',
    name: 'providers',
    message: 'Which LLM provider(s) do you want to configure?',
    choices: [
      { title: 'OpenAI', value: 'openai', selected: true },
      { title: 'AWS Bedrock', value: 'bedrock' },
    ],
    min: 1,
    hint: '- Space to select. Return to submit',
  })) as { providers: string[] }

  const config: ProviderConfig = {
    providers,
    primaryProvider: providers[0],
  }

  if (providers.includes('openai')) {
    const { openaiApiKey } = await prompt({
      type: 'text',
      name: 'openaiApiKey',
      message: 'OpenAI API key:',
      hint: 'Get one at https://platform.openai.com/api-keys',
    })
    config.openaiApiKey = openaiApiKey as string
  }

  if (providers.includes('bedrock')) {
    const { authMode } = (await prompt({
      type: 'select',
      name: 'authMode',
      message: 'How do you want to authenticate with AWS Bedrock?',
      choices: [
        { title: 'AWS Profile (recommended)', value: 'profile', description: 'Uses ~/.aws/credentials, requires AWS CLI' },
        { title: 'Access Keys', value: 'keys', description: 'Provide key ID + secret directly' },
      ],
    })) as { authMode: 'profile' | 'keys' }

    config.bedrockAuthMode = authMode

    if (authMode === 'profile') {
      const { awsProfile } = await prompt({
        type: 'text',
        name: 'awsProfile',
        message: 'AWS profile name:',
        initial: 'default',
        hint: 'Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html',
      })
      config.awsProfile = awsProfile as string
    } else {
      const keysResponse = await prompt([
        { type: 'text', name: 'awsAccessKeyId', message: 'AWS_ACCESS_KEY_ID:' },
        { type: 'password', name: 'awsSecretAccessKey', message: 'AWS_SECRET_ACCESS_KEY:' },
      ])
      config.awsAccessKeyId = keysResponse.awsAccessKeyId as string
      config.awsSecretAccessKey = keysResponse.awsSecretAccessKey as string
    }

    const { awsRegion } = await prompt({
      type: 'text',
      name: 'awsRegion',
      message: 'AWS region:',
      initial: 'us-east-1',
      hint: 'https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-regions.html',
    })
    config.awsRegion = awsRegion as string
  }

  if (providers.length > 1) {
    const { primaryProvider } = (await prompt({
      type: 'select',
      name: 'primaryProvider',
      message: 'Which provider should the app use by default?',
      choices: providers.map((p) => ({ title: PROVIDER_META[p].label, value: p })),
    })) as { primaryProvider: string }
    config.primaryProvider = primaryProvider
  }

  return config
}
