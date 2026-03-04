import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import fsExtra from 'fs-extra'
import prompts from 'prompts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const banner = `
  ${chalk.cyan('█████╗ ██████╗ ')}
  ${chalk.cyan('██╔══██╗╚════██╗')}
  ${chalk.cyan('███████║ █████╔╝')}
  ${chalk.cyan('██╔══██║ ╚═══██╗')}
  ${chalk.cyan('██║  ██║██████╔╝')}
  ${chalk.cyan('╚═╝  ╚═╝╚═════╝ ')}

  ${chalk.white.bold('A3')} ${chalk.dim('— Agentic App Architecture')}
`

async function main() {
  console.log(banner)

  let projectName = process.argv[2]

  if (!projectName) {
    const response = await prompts(
      {
        type: 'text',
        name: 'projectName',
        message: 'What is your project named?',
        initial: 'my-a3-quickstart',
      },
      {
        onCancel: () => {
          console.log(chalk.red('\nSetup cancelled.'))
          process.exit(1)
        },
      },
    )
    projectName = response.projectName as string
  }

  if (!projectName) {
    console.error(chalk.red('Project name is required.'))
    process.exit(1)
  }

  const targetDir = path.resolve(process.cwd(), projectName)

  if (fsExtra.existsSync(targetDir)) {
    const contents = fsExtra.readdirSync(targetDir)
    if (contents.length > 0) {
      console.error(chalk.red(`\nDirectory "${projectName}" already exists and is not empty.`))
      process.exit(1)
    }
  }

  const templateDir = path.resolve(__dirname, '..', 'template')

  if (!fsExtra.existsSync(templateDir)) {
    console.error(chalk.red('\nTemplate directory not found. The package may not have been built correctly.'))
    process.exit(1)
  }

  console.log(chalk.dim(`\nCreating a new A3 app in ${chalk.bold(targetDir)}...\n`))

  fsExtra.copySync(templateDir, targetDir)

  const pkgJsonPath = path.join(targetDir, 'package.json')
  if (fsExtra.existsSync(pkgJsonPath)) {
    const pkg = fsExtra.readJsonSync(pkgJsonPath) as Record<string, unknown>
    pkg.name = projectName
    delete pkg.private
    fsExtra.writeJsonSync(pkgJsonPath, pkg, { spaces: 2 })
  }

  const gitignoreSrc = path.join(targetDir, '_gitignore')
  const gitignoreDest = path.join(targetDir, '.gitignore')
  if (fsExtra.existsSync(gitignoreSrc)) {
    fsExtra.renameSync(gitignoreSrc, gitignoreDest)
  }

  console.log(chalk.cyan('Installing dependencies...\n'))

  try {
    execSync('npm install', {
      cwd: targetDir,
      stdio: 'inherit',
    })
  } catch {
    console.error(chalk.red('\nFailed to install dependencies. You can try manually:'))
    console.log(`  cd ${projectName}`)
    console.log('  npm install\n')
    process.exit(1)
  }

  console.log(`\n${chalk.green.bold('Success!')} Created ${chalk.bold(projectName)} at ${chalk.dim(targetDir)}\n`)
  console.log('Get started:\n')
  console.log(chalk.cyan(`  cd ${projectName}`))
  console.log(chalk.cyan('  npm run dev\n'))
}

main().catch((err) => {
  console.error(chalk.red('Unexpected error:'), err)
  process.exit(1)
})
