import { resolve } from 'path'
import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: !options.watch,
  splitting: false,
  treeshake: true,
  target: 'node20',
  outDir: 'dist',
  tsconfig: './tsconfig.json',
  esbuildOptions(options) {
    // Resolve path aliases to absolute paths for esbuild
    const alias = options.alias || {}
    const root = process.cwd()

    alias['@agents'] = resolve(root, 'agents')
    alias['@constants'] = resolve(root, 'src/constants')
    alias['@core'] = resolve(root, 'src/core')
    alias['@prompts'] = resolve(root, 'src/prompts')
    alias['@providers'] = resolve(root, 'src/providers')
    alias['@skills'] = resolve(root, 'src/skills')
    alias['@utils'] = resolve(root, 'src/utils')
    alias['types'] = resolve(root, 'src/types')

    options.alias = alias
  },
}))
