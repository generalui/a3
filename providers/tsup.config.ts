import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'bedrock/index': 'bedrock/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'node20',
  outDir: 'dist',
  tsconfig: './tsconfig.json',
  external: ['@genui-a3/core'],
})
