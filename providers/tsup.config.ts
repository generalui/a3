import { defineConfig } from 'tsup'
import path from 'path'

export default defineConfig({
  entry: { index: 'index.ts' },
  outDir: 'dist',
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'node20',
  tsconfig: './tsconfig.json',
  external: ['@genui/a3'],
  esbuildOptions(options) {
    options.alias = {
      '@providers/utils': path.resolve(process.cwd(), '..', 'utils'),
    }
  },
})
