import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import chalk from 'chalk'
import fs from 'fs-extra'
import { generateEnvFile, generateProviderFiles, scaffoldProject } from '@create-utils/generators'
import { promptProjectName, promptProviders } from '@create-utils/prompts'
import { PROVIDER_META, type ProviderConfig } from '@create-utils/providers'

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
  try {
    execSync('npm install --legacy-peer-deps', { cwd: targetDir, stdio: 'inherit' })
  } catch {
    p.log.error('Failed to install dependencies. You can try manually:')
    p.log.info(`  cd ${projectName}\n  npm install`)
    process.exit(1)
  }
}

function printSuccess(projectName: string, targetDir: string, config: ProviderConfig): void {
  const { label } = PROVIDER_META[config.primaryProvider]

  p.note(
    [
      `Primary provider: ${label}`,
      'Check .env for credentials configuration',
      '',
      'Get started:',
      '',
      `  cd ${projectName}`,
      '  npm run dev',
    ].join('\n'),
    `Created ${projectName} at ${targetDir}`,
  )

  p.outro('Happy building!')
}

async function main() {
  console.log(BANNER)
  p.intro('Create a new A3 app')

  const projectName = await promptProjectName()
  const targetDir = path.resolve(process.cwd(), projectName)

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    p.cancel(`Directory "${projectName}" already exists and is not empty.`)
    process.exit(1)
  }

  const templateDir = path.resolve(__dirname, '..', 'template')
  if (!fs.existsSync(templateDir)) {
    p.cancel('Template directory not found. The package may not have been built correctly.')
    process.exit(1)
  }

  const providerConfig = await promptProviders()

  p.log.info(`Creating a new A3 app in ${targetDir}`)

  const spin = p.spinner()

  spin.start('Scaffolding project files')
  scaffoldProject(templateDir, targetDir, projectName)
  spin.message('Configuring providers')
  generateProviderFiles(targetDir, providerConfig)
  spin.message('Generating .env file')
  generateEnvFile(targetDir, providerConfig)
  spin.stop('Project scaffolded')

  p.log.step('Installing dependencies...')
  installDependencies(targetDir, projectName)

  printSuccess(projectName, targetDir, providerConfig)
}

main().catch((err) => {
  p.cancel('Unexpected error')
  console.error(err)
  process.exit(1)
})
