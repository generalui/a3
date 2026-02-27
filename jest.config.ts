import type { Config } from 'jest'
// @ts-expect-error - ts-node ESM loader needs explicit .ts extension
import { baseConfig } from './jest.base.config.ts'

const customConfig: Config = {
  ...baseConfig,
  coverageDirectory: '<rootDir>/coverage/unit',
  testMatch: [
    '**/__tests__/unit/**/*.test.ts',
    '**/__tests__/unit/**/*.test.tsx',
    '**/__tests__/unit/**/*.spec.ts',
    '**/__tests__/unit/**/*.spec.tsx',
    '**/__tests__/step_definitions/jest/**/*.steps.ts',
  ],
}

export default customConfig
