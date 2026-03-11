PROJECT: A3 (Monorepo)

A3 is a monorepo for the A3 agentic backend framework ecosystem.

WORKSPACES & PACKAGES:

- src/           → @genui-a3/core — Core orchestration framework (main npm package)
- providers/     → @genui-a3/providers — Pluggable LLM provider implementations (e.g. Bedrock)
- agents/        → Temporary agent implementations used by the example app (may become individual npm packages)
- example/       → Example agentic application showcasing A3 usage (see example/CLAUDE.md)
- create/        → @genui-a3/create — CLI for quickstarting A3 applications

FUTURE DIRECTION:

- Providers will be extracted into individual npm packages (e.g., @genui-a3/bedrock, @genui-a3/openai, @genui-a3/anthropic)
- Agents will become individual npm packages (e.g., @genui-a3/agent-auth)

---

PACKAGE: @genui-a3/core

Core orchestration framework for agentic applications.
A developer-installable npm package that provides agent orchestration patterns.
Agents are separate entities that connect to the orchestration — created green-field by a developer or installed as npm packages.
Providers (OpenAI, Bedrock, Anthropic, etc.) are pluggable; a future goal is individual provider npm packages.

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
- @ag-ui/client — AG-UI protocol for agent-to-app communication and streaming events

PATH ALIASES:

- @core       → src/core
- @utils      → src/utils
- @providers  → src/providers
- @constants  → src/constants
- @prompts    → src/prompts
- @stores     → src/stores
- @agents     → agents/ (root — temporary; will be removed when agents become npm packages)
- types       → src/types (bare module name, no @ prefix — always import as 'types' or 'types/submodule')
- `types/*`   → src/types/* (sub-module imports, e.g. import { Events } from 'types/events')
Note: @skills alias exists in config but src/skills/ does not — do not use.

FOLDER STRUCTURE (src/):

- src/
  - core/            → Core framework logic (agent, chatFlow, schemas, registry, streaming)
  - providers/       → Provider implementations (awsBedrock example)
  - stores/          → Memory/session store implementations (configurable via API)
  - types/           → TypeScript type definitions
  - utils/           → Utility functions (uuid, date parsing, etc.)
  - constants/       → Application constants
  - prompts/         → Shared prompt templates
  - index.ts         → Main entry point (exports)
- __tests__/         → Test files (unit, integration)
- dist/              → Build output (generated, git-ignored)
- no_commit/         → Local secrets, git-ignored

KEY FILES:

- src/index.ts                        → Main package exports
- src/core/agent.ts                   → Agent request preparation and response generation
- src/core/chatFlow.ts                → Conversation flow and agent-switching management
- src/core/schemas.ts                 → Base response schemas
- src/core/AgentRegistry.ts           → Agent registration and lookup
- src/core/AGUIAgent.ts               → AG-UI protocol integration
- src/core/chatSession.ts             → Chat session management
- src/core/streamProcessor.ts         → Streaming response processing
- src/stores/memoryStore.ts           → Base memory store interface
- providers/bedrock/index.ts          → AWS Bedrock provider implementation (createBedrockProvider)
- src/types/agent.ts                  → Agent interface and types
- package.json                        → Package configuration, dependencies
- tsup.config.ts                      → Build configuration
- jest.base.config.ts                 → Jest test configuration

ARCHITECTURE:

- Agents are registered with the core framework via AgentRegistry
- Each agent implements the Agent interface (id, prompt, outputSchema, transition, etc.)
- Providers implement the Provider interface (sendRequest, sendRequestStream) and are pluggable; installed as separate packages
- ChatSession requires a provider instance at construction time
- Chat flow manages agent switching — deterministic (transition function, code-controlled) or LLM-driven (transition array of target agent IDs)
- AG-UI protocol (@ag-ui/client) handles agent-to-app communication and streaming events
- Response schemas use zod for validation
- Stores provide configurable memory/session persistence
- Path aliases (@agents, @core, @utils, etc.) for clean imports

CODING CONVENTIONS:

Exports:

- Named exports only — no default exports anywhere in src/
- Re-export via barrel index.ts files per directory

TypeScript:

- Generic parameters follow the pattern: `TState extends BaseState`, `TContext extends BaseChatContext = BaseChatContext`
- Use `interface` for object shapes; `type` for unions and aliases
- `private readonly` for immutable class properties
- Mark fire-and-forget promises with `void` keyword: `void someAsyncFn()`
- `strict` and `strictNullChecks` are enabled — no implicit any or null

Functions vs Classes:

- Classes for stateful entities, singletons, and interface implementations (AgentRegistry, ChatSession, stores, AGUIAgent)
- Prefer named function declarations (`export function foo()`) for exported utilities — cleaner with generics, better stack traces, and hoisted
- Async generators always use named function syntax: `export async function* name()`
- Non-exported internal helpers use named function declarations, not arrow functions

Naming:

- camelCase for variables, functions, and file names
- PascalCase for classes, interfaces, and type aliases
- SCREAMING_SNAKE_CASE for module-level constants

Imports:

- Use path aliases over relative imports except within the same directory (use `'./sibling'` for same-folder imports)
- Import from `'types'` (bare) for src/types — never `'@types'`
- Sub-module type imports: `import { Events } from 'types/events'`

Documentation:

- JSDoc with @param, @returns, @throws, and @example on all public APIs
- Inline comments for non-obvious logic only — do not comment self-evident code

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
- Unit watch mode: `npm run test:unit:watch`
- All tests watch mode: `npm run test:watch`
- Jest configured with ts-jest for TypeScript support
- jsdom environment for browser API testing

BUILD & PUBLISH:

- Build: `npm run build` (generates dist/ with ESM, CJS, and .d.ts files)
- Clean: `npm run clean` (removes dist/)
- Dev: `npm run dev` (watch mode for core + example in parallel)
- Publish: `npm publish` (runs prepublishOnly: clean + build)
- Package name: @genui-a3/core
- Organization: genui-a3 (npm)

CI/CD:

- Workflow TBD: Should build, test, publish to NPM, and tag repo on merge to main
- Pre-publish: Run tests and linting
- Post-publish: Create git tag with version
