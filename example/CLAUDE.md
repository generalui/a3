# Example App

Next.js example for @genui/a3. AI rules for this app (Claude Code and Cursor). Single source of truth; Cursor uses via symlink `.cursorrules` → this file.

## Stack

- Next.js 16.1.6 (App Router), React 19, TypeScript 5.9+
- Testing infrastructure planned (not yet configured)
- MUI 7 (@mui/material) + styled-components for styling (`app/theme.ts`, `app/ThemeProvider.tsx`)

## Dependencies

- Pin all npm package versions (no `^` or `~`).
- Use exact versions in package.json so installs are reproducible.

## React / TypeScript

- Named functions over arrow function assignments
- Proper types and interfaces; follow React hooks rules and lifecycle
- Error boundaries and handling where appropriate
- Path aliases (from `tsconfig.json`):
  - `@atoms` → `./app/components/atoms`
  - `@molecules` → `./app/components/molecules`
  - `@organisms` → `./app/components/organisms`
  - `@components` → `./app/components`
  - `@constants` → `./app/constants`
  - `types` → `./app/types` (bare module, no @ prefix)

## Dev Commands

- `npm run dev` — Start Next.js dev server
- `npm run build` — Build for production
- `npm run start` — Start production server

## Next.js

- Use App Router, Server Components, Client Components, Server Actions, middleware as appropriate

## Code Organization

- Single-responsibility components; separation of concerns
- Constants for config and string literals; clean folder structure; DRY
- Use Atomic Design for component hierarchy (see below)
- `app/api/` — API routes (agui, chat, stream endpoints)
- `app/(pages)/` — Route groups (agui, chat, stream pages)
- `app/agents/` — Agent implementations (e.g. age.ts, greeting.ts)
- `app/lib/providers/` — Provider factory functions (Anthropic, Bedrock, OpenAI)

## Component hierarchy (Atomic Design)

- Place UI components under `app/components/` in Atomic Design layers:
  1. **atoms/** — Single-purpose primitives (e.g. MessageBubble, buttons, inputs).
  2. **molecules/** — Compositions of atoms (e.g. ChatMessage, ChatInput).
  3. **organisms/** — Compositions of molecules and layout (e.g. Chat, ChatMessageList).
- Pages import from organisms (or molecules when no organism exists).
- Each layer may only use components from the same or lower layers (atoms use MUI/styled only; molecules use atoms; organisms use molecules/atoms).
- Export public components via `index.ts` per folder.

## State & Data

- Appropriate React hooks; clear data flow
- Handle loading, error, and success states; predictable updates

## Testing

Testing infrastructure is not yet configured for the example app.
When added, tests should be comprehensive, runnable in isolation, and cover error cases.

## Naming Conventions

- camelCase for variables, functions, and file names
- PascalCase for React components, interfaces, and type aliases
- SCREAMING_SNAKE_CASE for module-level constants

## API & UX

- Proper error handling and loading states; correct response types; separate API logic
- Loading states, clear error messages, responsive design, accessibility

## Security

- Sensitive data handled appropriately (HIPAA-aware)
- Auth/authz where needed; no keys or tokens in code

## Docs

- Markdown per markdownlint (new line per sentence, "1." for lists; config inherited from root `.markdownlint.json`)

## Workflow

- **Please understand the requirements of this project before building.**
- **Please ask any clarifying questions before making any changes or recommendations.**

1. Understand requirements (business, technical, non-functional)
2. Plan implementation
3. Write tests, then code that passes them
4. Document decisions; review for best practices

Use latest React and TypeScript syntax. Code should be clean, readable, maintainable, efficient, and DRY.

## A3 Framework Documentation

The `docs/` directory contains essential A3 framework documentation.
**You MUST read the relevant files below** before implementing or modifying any feature that touches A3 agents, providers, sessions, resilience, or logging.

| File | Topic |
|---|---|
| `docs/API-REFERENCE.md` | Core exports, types, and API descriptions |
| `docs/ARCHITECTURE.md` | Framework architecture and system design |
| `docs/CORE-CONCEPTS.md` | Agents, providers, and fundamental building blocks |
| `docs/CUSTOM_LOGGING.md` | Supplying a custom logger via `configureLogger()` |
| `docs/CUSTOM_PROVIDERS.md` | Creating a custom provider and streaming support |
| `docs/INITIAL_PROMPT.md` | System prompts and instructions for AI agents |
| `docs/LOGGING.md` | Internal logging architecture, `log` singleton, log levels |
| `docs/PROVIDERS.md` | Provider setup (Bedrock, OpenAI, Anthropic), config options, model fallback, per-agent overrides |
| `docs/QUICK-START-EXAMPLES.md` | Agent definitions, registration, multi-agent flows, ChatSession usage |
| `docs/RESILIENCE.md` | Retry, backoff, timeout config, error classification, resilience error handling |
| `docs/TRANSITIONS.md` | Agent hand-offs and transition control |

When in doubt about A3 API usage, patterns, or configuration — **read the relevant doc file first**.
Any new `.md` files added to `docs/` are part of this documentation set and should be consulted as needed.
