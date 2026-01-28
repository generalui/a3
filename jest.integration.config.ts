import type { Config } from 'jest'
import { baseConfig } from './jest.base.config'

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
