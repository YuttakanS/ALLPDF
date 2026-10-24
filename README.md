# Thai-First PDF Web Toolkit

A client-only, privacy-respecting PDF toolkit with first-class Thai language support, running entirely inside your browser via WebAssembly.

## Purpose

Personal, non-commercial tool designed for private and community use. Zero tracking, zero telemetry, no accounts, and no server-side document processing—your files never leave your device.

For complete background, requirements, and roadmaps, please refer to [docs/BRIEF.md](docs/BRIEF.md).

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS, version pinned in `.nvmrc`)
- [pnpm](https://pnpm.io/) (`>= 9`)

## Installation

```bash
pnpm install
```

To install Playwright browser binaries for E2E testing:

```bash
pnpm exec playwright install chromium
```

## Available Scripts

- `pnpm dev`: Start the Vite development server with COOP/COEP isolation headers.
- `pnpm build`: Typecheck and build the production bundle and PWA service worker.
- `pnpm preview`: Preview the production build locally with COOP/COEP headers.
- `pnpm lint`: Run ESLint across the codebase.
- `pnpm format`: Format files with Prettier.
- `pnpm typecheck`: Run TypeScript type-checker (`tsc --noEmit`).
- `pnpm test`: Run unit and integration tests using Vitest.
- `pnpm test:e2e`: Run end-to-end tests using Playwright (Chromium).
- `pnpm check`: Convenience script executing `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) due to dependencies including MuPDF.
