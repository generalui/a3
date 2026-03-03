import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const exampleDir = path.resolve(rootDir, '..', 'example');
const templateDir = path.resolve(rootDir, 'template');

const INCLUDE = [
  'app',
  'public',
  'package.json',
  'next.config.mjs',
  'tsconfig.json',
  '.gitignore',
];

const EXCLUDE = [
  'node_modules',
  '.next',
  'tsconfig.tsbuildinfo',
  '.cursor',
  'next-env.d.ts',
  '.cursorrules',
  'CLAUDE.md',
  'README.md',
];

// Clean and recreate template dir
if (fs.existsSync(templateDir)) {
  fs.rmSync(templateDir, { recursive: true });
}
fs.mkdirSync(templateDir, { recursive: true });

// Copy included items from example/
for (const item of INCLUDE) {
  const src = path.join(exampleDir, item);
  const dest = path.join(templateDir, item);

  if (!fs.existsSync(src)) {
    console.warn(`Warning: ${item} not found in example/, skipping.`);
    continue;
  }

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    copyDirFiltered(src, dest);
  } else {
    fs.copyFileSync(src, dest);
  }
  console.log(`Copied: ${item}`);
}

// Resolve @genui-a3/core version from npm registry
let coreVersion;
try {
  coreVersion = execSync('npm view @genui-a3/core version', {
    encoding: 'utf-8',
  }).trim();
  console.log(`Resolved @genui-a3/core version: ${coreVersion}`);
} catch {
  console.warn(
    'Warning: Could not fetch @genui-a3/core version from npm. Using "latest".',
  );
  coreVersion = 'latest';
}

// Update template package.json
const pkgPath = path.join(templateDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

if (pkg.dependencies?.['@genui-a3/core']) {
  pkg.dependencies['@genui-a3/core'] =
    coreVersion === 'latest' ? 'latest' : `^${coreVersion}`;
}

delete pkg.private;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Updated template package.json');

// Rename .gitignore → _gitignore (npm publish workaround)
const gitignoreSrc = path.join(templateDir, '.gitignore');
const gitignoreDest = path.join(templateDir, '_gitignore');
if (fs.existsSync(gitignoreSrc)) {
  fs.renameSync(gitignoreSrc, gitignoreDest);
  console.log('Renamed .gitignore → _gitignore');
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
`;

fs.writeFileSync(path.join(templateDir, 'README.md'), readme);
console.log('Wrote template README.md');

console.log('\nTemplate prepared successfully.');

// --- Helpers ---

function copyDirFiltered(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirFiltered(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
