import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const monorepoRoot = path.resolve(rootDir, '..')
const exampleDir = path.resolve(monorepoRoot, 'example')
const docsDir = path.resolve(monorepoRoot, 'docs')
const templateDir = path.resolve(rootDir, 'template')

const EXCLUDE = ['node_modules', '.next', 'tsconfig.tsbuildinfo', '.env', '.env.example', 'README.md', '.cursorrules']

const GENUI_PACKAGES = ['@genui-a3/core', '@genui-a3/providers']

// --- Helpers ---

/**
 * Recursively copy directory, excluding specified entries.
 */
function copyDirFiltered(src, dest) {
  fs.mkdirSync(dest, { recursive: true })

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE.includes(entry.name)) continue

    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirFiltered(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * Resolve latest version from npm registry.
 * Returns a semver range (e.g. "^1.2.3") or "latest" on failure.
 */
function resolveNpmVersion(packageName) {
  try {
    const version = execSync(`npm view ${packageName} version`, {
      encoding: 'utf-8',
    }).trim()
    console.log(`Resolved ${packageName} version: ${version}`)
    return `^${version}`
  } catch {
    console.warn(`Warning: Could not fetch ${packageName} version from npm. Using "latest".`)
    return 'latest'
  }
}

// --- Main ---

// Clean and recreate template dir
if (fs.existsSync(templateDir)) {
  fs.rmSync(templateDir, { recursive: true })
}
fs.mkdirSync(templateDir, { recursive: true })

// Copy everything from example/ except EXCLUDE
copyDirFiltered(exampleDir, templateDir)
console.log('Copied example/ to template/ (excluding specified files)')

// Resolve package versions and update template package.json
const pkgPath = path.join(templateDir, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
pkg.dependencies = pkg.dependencies || {}

for (const packageName of GENUI_PACKAGES) {
  pkg.dependencies[packageName] = resolveNpmVersion(packageName)
}

delete pkg.private
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('Updated template package.json')

// Remove providers/index.ts — the CLI generates it dynamically
const providersIndex = path.join(templateDir, 'app', 'lib', 'providers', 'index.ts')
if (fs.existsSync(providersIndex)) {
  fs.unlinkSync(providersIndex)
}

// Rename .gitignore → _gitignore (npm publish workaround)
const gitignoreSrc = path.join(templateDir, '.gitignore')
const gitignoreDest = path.join(templateDir, '_gitignore')
if (fs.existsSync(gitignoreSrc)) {
  fs.renameSync(gitignoreSrc, gitignoreDest)
  console.log('Renamed .gitignore → _gitignore')
}

// Copy documentation files from monorepo docs/
const templateDocsDir = path.join(templateDir, 'docs')
if (fs.existsSync(docsDir)) {
  fs.mkdirSync(templateDocsDir, { recursive: true })

  for (const entry of fs.readdirSync(docsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue

    fs.copyFileSync(path.join(docsDir, entry.name), path.join(templateDocsDir, entry.name))
    console.log(`Copied doc: ${entry.name}`)
  }
} else {
  console.warn('Warning: docs/ directory not found, skipping documentation copy.')
}

// Write a simple README.md
const readme = `# A3 App

Built with [GenUI A3](https://www.npmjs.com/package/@genui-a3/core).

## Documentation

Local documentation is available in the [\`./docs\`](./docs) folder. Check there for concepts, recipes, and API reference!

## Getting Started

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Learn More

- [A3 Core Documentation](https://www.npmjs.com/package/@genui-a3/core)
- [Next.js Documentation](https://nextjs.org/docs)
`

fs.writeFileSync(path.join(templateDir, 'README.md'), readme)
console.log('Wrote template README.md')

console.log('\nTemplate prepared successfully.')
