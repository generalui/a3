import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const exampleDir = path.resolve(rootDir, '..', 'example')
const templateDir = path.resolve(rootDir, 'template')

const INCLUDE = ['app', 'public', 'package.json', 'next.config.mjs', 'tsconfig.json', '.gitignore']

const EXCLUDE = [
  'node_modules',
  '.next',
  'tsconfig.tsbuildinfo',
  '.cursor',
  'next-env.d.ts',
  '.cursorrules',
  'CLAUDE.md',
  'README.md',
  '.env.example',
]

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

// Copy included items from example/
for (const item of INCLUDE) {
  const src = path.join(exampleDir, item)
  const dest = path.join(templateDir, item)

  if (!fs.existsSync(src)) {
    console.warn(`Warning: ${item} not found in example/, skipping.`)
    continue
  }

  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    copyDirFiltered(src, dest)
  } else {
    fs.copyFileSync(src, dest)
  }
  console.log(`Copied: ${item}`)
}

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

// Remove provider.ts — the CLI generates it dynamically via generateProviderFile()
const providerFile = path.join(templateDir, 'app', 'lib', 'provider.ts')
if (fs.existsSync(providerFile)) {
  fs.unlinkSync(providerFile)
  console.log('Removed app/lib/provider.ts (generated dynamically by CLI)')
}

// Rename .gitignore → _gitignore (npm publish workaround)
const gitignoreSrc = path.join(templateDir, '.gitignore')
const gitignoreDest = path.join(templateDir, '_gitignore')
if (fs.existsSync(gitignoreSrc)) {
  fs.renameSync(gitignoreSrc, gitignoreDest)
  console.log('Renamed .gitignore → _gitignore')
}

// Write a simple README.md
const readme = `# A3 App

Built with [GenUI A3](https://www.npmjs.com/package/@genui-a3/core).

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
