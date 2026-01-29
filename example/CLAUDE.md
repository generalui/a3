# Example App

Next.js example for @genui-a3/core. AI rules for this app (Claude Code and Cursor). Single source of truth; Cursor uses via symlink `.cursorrules` → this file.

## Stack

- Next.js 16.1.6 (App Router), React 19, TypeScript 5.9+
- Playwright (to be implemented), Jest for tests
- Styled components for styling (base theme TBD)

## Dependencies

- Pin all npm package versions (no `^` or `~`).
- Use exact versions in package.json so installs are reproducible.

## React / TypeScript

- Named functions over arrow function assignments
- Proper types and interfaces; follow React hooks rules and lifecycle
- Error boundaries and handling where appropriate
- See repo `tsconfig.base.json` for path aliases; example uses `@/*` → `./*`

## Next.js

- Use App Router, Server Components, Client Components, Server Actions, middleware as appropriate

## Code Organization

- Single-responsibility components; separation of concerns
- Constants for config and string literals; clean folder structure; DRY
- Use Atomic Design for component hierarchy (see below)

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

- Unit tests comprehensive; runnable in isolation; test the right behavior
- Include error cases; mock externals appropriately
- Playwright for E2E (when implemented)

## API & UX

- Proper error handling and loading states; correct response types; separate API logic
- Loading states, clear error messages, responsive design, accessibility

## Security

- Sensitive data handled appropriately (HIPAA-aware)
- Auth/authz where needed; no keys or tokens in code

## Docs

- Markdown per markdownlint (new line per sentence, "1." for lists, .markdownlint.json)

## Workflow

1. Understand requirements (business, technical, non-functional)
2. Plan implementation
3. Write tests, then code that passes them
4. Document decisions; review for best practices

Use latest React and TypeScript syntax. Code should be clean, readable, maintainable, efficient, and DRY.
