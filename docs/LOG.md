# Project Activity Log

## Dependencies Added

- `mupdf` (^1.28.1): MuPDF WebAssembly build for client-side PDF document manipulation and rendering.
- `react` (^19.0.0): UI component library for building the application shell and viewer UI.
- `react-dom` (^19.0.0): React DOM renderer for mounting the client UI.
- `@eslint/js` (^9.21.0): ESLint standard JavaScript recommended configuration.
- `@playwright/test` (^1.50.1): End-to-end browser automation and security testing framework.
- `@types/node` (^22.13.5): TypeScript type definitions for Node.js APIs used in configs and tests.
- `@types/react` (^19.0.10): TypeScript type definitions for React components.
- `@types/react-dom` (^19.0.4): TypeScript type definitions for React DOM.
- `@vitejs/plugin-react` (^4.3.4): Official Vite plugin enabling JSX transform and Fast Refresh.
- `eslint` (^9.21.0): Pluggable linting utility for maintaining code quality.
- `eslint-config-prettier` (^10.0.1): Turns off conflicting ESLint formatting rules in favor of Prettier.
- `eslint-plugin-react-hooks` (^5.1.0): ESLint rules enforcing React hooks contracts and dependency arrays.
- `eslint-plugin-react-refresh` (^0.4.19): Validates components for safe React Fast Refresh.
- `prettier` (^3.5.2): Code formatting tool ensuring consistent code styling across the codebase.
- `typescript` (^5.7.3): TypeScript compiler for static type checking with strict flags.
- `typescript-eslint` (^8.24.1): Tooling allowing ESLint to parse and lint TypeScript files in flat config.
- `vite` (^6.2.0): Next-generation frontend tooling providing dev server and Rollup production builds.
- `vite-plugin-pwa` (^0.21.1): Generates Service Worker and Web App Manifest for offline PWA operation.
- `vitest` (^3.0.7): Fast, Vite-native unit and integration test runner.

## Verification Results

1. **`pnpm install`**: Passed.
   - Pinned Node LTS (`22` in `.nvmrc`, `>=22.0.0` in `package.json` engines).
   - Package manager: `pnpm@12.15.0`.
   - `pnpm-workspace.yaml` configured with `allowBuilds: esbuild: true`.

2. **`pnpm check`** (`pnpm lint && pnpm typecheck && pnpm test`): Passed.
   - `eslint .`: 0 errors, 0 warnings.
   - `tsc --noEmit`: 0 errors.
   - `vitest run`: 3 test files passed (3 tests total: Thai word segmentation, worker transferable zero-copy round-trip, MuPDF in-memory PDF spike). Duration: ~370ms.

3. **`pnpm build`**: Passed.
   - Vite built production client bundle in `dist/`.
   - PWA Service Worker (`dist/sw.js`, `dist/workbox-9c191d2f.js`) generated.
   - Precached 4 app-shell entries (220 KiB); large models, fonts, and WASM binaries excluded from precache.

4. **`pnpm test:e2e`**: Passed.
   - Chromium headless launched against `vite preview` on `http://127.0.0.1:4173`.
   - Verified UI renders and `window.crossOriginIsolated === true` under COOP/COEP isolation headers.

## Feasibility Spike: MuPDF WASM

- `mupdf@1.28.1` was imported and executed in a worker context.
- Successfully created a memory-backed PDF document (`new mupdf.PDFDocument()`), inserted a blank page (`doc.addPage([0, 0, 612, 792], 0, mupdf.PDFObject.Null, new mupdf.Buffer())`), and verified `doc.countPages() === 1`.
- Vite's ES module worker format and asset pipeline successfully resolved the package and top-level await modules.

## Open Questions

- None at the completion of initial scaffolding.
