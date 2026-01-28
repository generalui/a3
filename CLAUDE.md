PROJECT: A3 Core

Core package for the A3 agentic backend framework.
A developer-installable npm package that provides agent orchestration patterns.
Agents can be registered with the core framework.
Providers (OpenAI, Bedrock, Anthropic, etc.) are pluggable via additional packages.

CONSTRAINTS:

- Node.js 20.19.0+ required
- A provider package must be installed and configured (Bedrock provider included as example)
- TypeScript 5.9.3+
- Dual ESM/CJS output for maximum compatibility

TECH STACK:

- Node.js 20.19.0+
- TypeScript 5.9.3
- tsup 8.5.1 for building (dual ESM/CJS output)
- Jest 30.2.0 for testing (with ts-jest, jsdom environment)
- ESLint 9.39.2 + Prettier 3.7.4 for linting/formatting
- zod 4.3.6 for schema validation
- Path aliases for clean imports (@agents, @core, @utils, etc.)

FOLDER STRUCTURE:

- src/
  - agents/          → Agent implementations (auth, discharge, etc.)
  - core/            → Core framework logic (agent, chatFlow, schemas)
  - providers/       → Provider implementations (awsBedrock example)
  - skills/          → Skill-based agent extensions
  - types/           → TypeScript type definitions
  - utils/           → Utility functions (logger, uuid, date parsing, etc.)
  - constants/       → Application constants
  - prompts/         → Shared prompt templates
  - index.ts         → Main entry point (exports)
- __tests__/         → Test files (unit, integration)
- dist/              → Build output (generated, git-ignored)
- no_commit/         → Local secrets, git-ignored

KEY FILES:

- src/index.ts                    → Main package exports
- src/core/agent.ts               → Agent response generation logic
- src/core/chatFlow.ts            → Conversation flow management
- src/core/schemas.ts              → Base response schemas
- src/providers/awsBedrock.ts     → AWS Bedrock provider implementation (example)
- src/agents/basePrompt.ts         → Base prompt template for agents
- src/types/agent.ts               → Agent interface and types
- package.json                     → Package configuration, dependencies
- tsup.config.ts                   → Build configuration
- jest.base.config.ts              → Jest test configuration

ARCHITECTURE:

- Agents are registered with the core framework
- Each agent implements the Agent interface (id, promptGenerator, responseFormat, etc.)
- Providers are pluggable and handle LLM communication
- Chat flow manages agent switching based on responses
- Response schemas use zod for validation
- Path aliases (@agents, @core, @utils, etc.) for clean imports

CONFIGURATION:

- TypeScript: tsconfig.json, tsconfig.base.json, tsconfig.eslint.json
- Build: tsup.config.ts (dual ESM/CJS, declarations, sourcemaps)
- Testing: jest.base.config.ts, jest.config.ts, jest.integration.config.ts
- Linting: eslint.config.mjs, .prettierrc
- Markdown: .markdownlint.json
- Node version: .tool-versions (20.19.0)
- Git commits: .git-commit-template.txt

GIT:

- Feature branches → PR to `main`
- No direct commits to `main`
- Merges to `main` should trigger:
  1. Package build
  2. NPM publish (@genui-a3/core)
  3. Git tag with version number

SECRETS:

- no_commit/ is git-ignored, contains local secrets/config
- Never expose API keys, tokens, or credentials in code
- Provider credentials should be configured via environment variables

DOCUMENTATION:

- Follow markdownlint rules per .markdownlint.json
- Use "1." for all numbered lists (not 1, 2, 3)
- Start sentences on new lines
- README.md should be included in published package

TESTING:

- Unit tests: `npm run test:unit` (__tests__/unit/)
- Integration tests: `npm run test:integration`
- Coverage: `npm run test:coverage`
- Watch mode: `npm run test:watch`
- Jest configured with ts-jest for TypeScript support
- jsdom environment for browser API testing

BUILD & PUBLISH:

- Build: `npm run build` (generates dist/ with ESM, CJS, and .d.ts files)
- Clean: `npm run clean` (removes dist/)
- Dev: `npm run dev` (watch mode)
- Publish: `npm publish` (runs prepublishOnly: clean + build)
- Package name: @genui-a3/core
- Organization: genui-a3 (npm)

CI/CD:

- Workflow TBD: Should build, test, publish to NPM, and tag repo on merge to main
- Pre-publish: Run tests and linting
- Post-publish: Create git tag with version
