# @genui-a3/create

Scaffold a new [A3](https://www.npmjs.com/package/@genui-a3/core) agentic app in seconds.

## Quick Start

```bash
npx @genui-a3/create@latest my-app
```

This will:

1. Create a new directory with your project name
1. Copy a production-ready Next.js template
1. Install all dependencies automatically

Then start developing:

```bash
cd my-app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

## What You Get

A fully configured Next.js application with:

- **Chat interface** — conversational UI backed by A3 agents
- **Streaming responses** — real-time streamed agent output
- **AG-UI protocol support** — compatible with the [AG-UI](https://docs.ag-ui.com) standard
- **Agent registration** — define and wire up custom agents using `@genui-a3/core`
- **Material UI** — pre-configured theming with MUI components
- **TypeScript** — strict type-checking out of the box

## Usage

```bash
# Interactive — prompts for a project name
npx @genui-a3/create@latest

# Non-interactive — pass the name directly
npx @genui-a3/create@latest my-app
```

The CLI will not overwrite a non-empty directory.

## Project Structure

```txt
my-app/
├── app/
│   ├── (pages)/        # Route groups (chat, stream, agui)
│   ├── agents/         # Agent definitions
│   ├── api/            # API routes
│   ├── components/     # Shared UI components
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Landing page
├── public/             # Static assets
├── package.json
├── tsconfig.json
└── next.config.mjs
```

## Available Scripts

Inside a generated project you can run:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production server |

## Local Development

Test the CLI locally before publishing by packing it into a tarball.

```bash
# 1. Build a local tarball
npm pack

# This will create a file named genui-a3-create-0.x.x.tgz at the root of this package

# 2. Switch to your desired test directory
cd ../my-test-workspace

# 3. Scaffold a new project using the tarball
npx --package=/absolute/path/to/genui-a3-create-0.x.x.tgz create-genui-a3
```

## Prerequisites

- Node.js 20.19.0 or later
- npm 10+

## Related

- [@genui-a3/core](https://www.npmjs.com/package/@genui-a3/core) — the core A3 agentic framework that powers scaffolded apps

## License

ISC
