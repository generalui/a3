import type { Config } from 'jest'
// @ts-expect-error - ts-node ESM loader needs explicit .ts extension
import { baseConfig } from './jest.base.config.ts'

const integrationConfig: Config = {
  ...baseConfig,
  coverageDirectory: '<rootDir>/coverage/integration',
  testMatch: [
    '**/__tests__/integration/**/*.test.ts',
    '**/__tests__/integration/**/*.test.tsx',
    '**/__tests__/integration/**/*.spec.ts',
    '**/__tests__/integration/**/*.spec.tsx',
  ],
}

export default integrationConfig
