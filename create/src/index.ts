import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import fs from 'fs-extra'

import { generateEnvFile, generateProviderFile, scaffoldProject } from './utils/generators'
import { promptProjectName, promptProviders } from './utils/prompts'
import { PROVIDER_META, type ProviderConfig } from './utils/providers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BANNER = `
  ${chalk.cyan('█████╗ ██████╗ ')}
  ${chalk.cyan('██╔══██╗╚════██╗')}
  ${chalk.cyan('███████║ █████╔╝')}
  ${chalk.cyan('██╔══██║ ╚═══██╗')}
  ${chalk.cyan('██║  ██║██████╔╝')}
  ${chalk.cyan('╚═╝  ╚═╝╚═════╝ ')}

  ${chalk.white.bold('A3')} ${chalk.dim('— Agentic App Architecture')}
`

function installDependencies(targetDir: string, projectName: string): void {
  console.log(chalk.cyan('Installing dependencies...\n'))

  try {
    execSync('npm install', { cwd: targetDir, stdio: 'inherit' })
  } catch {
    console.error(chalk.red('\nFailed to install dependencies. You can try manually:'))
    console.log(`  cd ${projectName}`)
    console.log('  npm install\n')
    process.exit(1)
  }
}

function printSuccess(projectName: string, targetDir: string, config: ProviderConfig): void {
  const { label } = PROVIDER_META[config.primaryProvider]

  console.log(`\n${chalk.green.bold('Success!')} Created ${chalk.bold(projectName)} at ${chalk.dim(targetDir)}\n`)
  console.log(`  ${chalk.bold('Primary provider:')} ${label}`)
  console.log(`  ${chalk.dim('Check .env for credentials configuration')}\n`)

  if (config.providers.includes('bedrock') && config.bedrockAuthMode === 'profile') {
    console.log(chalk.yellow('  Note: Bedrock with AWS Profile requires the AWS CLI to be installed.'))
    console.log(chalk.dim('  https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html\n'))
  }

  console.log('Get started:\n')
  console.log(chalk.cyan(`  cd ${projectName}`))
  console.log(chalk.cyan('  npm run dev\n'))
}

async function main() {
  console.log(BANNER)

  const projectName = await promptProjectName()
  const targetDir = path.resolve(process.cwd(), projectName)

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.error(chalk.red(`\nDirectory "${projectName}" already exists and is not empty.`))
    process.exit(1)
  }

  const templateDir = path.resolve(__dirname, '..', 'template')
  if (!fs.existsSync(templateDir)) {
    console.error(chalk.red('\nTemplate directory not found. The package may not have been built correctly.'))
    process.exit(1)
  }

  console.log('')
  const providerConfig = await promptProviders()

  console.log(chalk.dim(`\nCreating a new A3 app in ${chalk.bold(targetDir)}...\n`))

  scaffoldProject(templateDir, targetDir, projectName)
  generateProviderFile(targetDir, providerConfig.primaryProvider)
  generateEnvFile(targetDir, providerConfig)
  installDependencies(targetDir, projectName)
  printSuccess(projectName, targetDir, providerConfig)
}

main().catch((err) => {
  console.error(chalk.red('Unexpected error:'), err)
  process.exit(1)
})
