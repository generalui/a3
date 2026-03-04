// @ts-check
// Note: This config manually configures Next.js/React rules instead of using
// eslint-config-next's 'next/core-web-vitals' because Next.js 16's config has
// circular references that cause issues with FlatCompat. This approach provides
// the same rules without the compatibility layer.
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.vscode/*',
      'dist/*',
      'coverage/*',
      'node_modules/*',
      '*.setup.ts',
      'no_commit/*',
      '*/next-env.d.ts',
      'example/node_modules/*',
      'example/npm_modules/*',
      'example/.next/*',
      'create/template/*',
      'example_agent_core/dist/*',
      'example_agent_core/node_modules/*',
      'example_agent_core/npm_modules/*',
    ],
  },
  eslint.configs.recommended,
  // Example app config - uses its own tsconfig for TS/TSX files (must come before type-checked configs)
  {
    files: ['example/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './example/tsconfig.json',
      },
    },
  },
  {
    files: ['example/**/*.{js,jsx,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Example Agent Core config
  {
    files: ['example_agent_core/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './example_agent_core/tsconfig.json',
      },
    },
  },
  // Create CLI config
  {
    files: ['create/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './create/tsconfig.json',
      },
    },
  },
  // Main app config
  ...tseslint.configs.recommendedTypeChecked,
  // React rules (manually configured to avoid FlatCompat circular structure issues)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['example/**', 'example_agent_core/**', 'create/**'],
    plugins: {},
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
      'react/prop-types': 'off', // Using TypeScript for prop validation
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['example/**', 'example_agent_core/**', 'create/**'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },
    rules: {
      complexity: 'error',
      'default-case-last': 'error',
      'default-param-last': 'off',
      'dot-notation': 'off',
      eqeqeq: 'error',
      'guard-for-in': 'error',
      'max-depth': 'error',
      'no-await-in-loop': 'error',
      'no-duplicate-imports': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-promise-executor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-private-class-members': 'error',
      'no-unused-vars': 'off',
      'no-use-before-define': 'off',
      'no-useless-rename': 'error',
      'no-sequences': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'require-atomic-updates': 'error',
      'require-await': 'off',
      '@typescript-eslint/default-param-last': 'error',
      '@typescript-eslint/dot-notation': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, typedefs: false }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
    },
  },
  // Config files - disable type checking (not in tsconfig)
  {
    files: ['*.config.{js,mjs,ts}', 'jest.*.ts', 'tsup.config.ts', 'create/tsup.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Jest test files config
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      // Jest mock method doesn't require binding
      '@typescript-eslint/unbound-method': 'off',
    },
  },
)
