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

## Phase 1.1: Engine Facade & Worker Protocol (`branch: phase-1`)

### What Was Done
- Implemented `PdfDocument` facade (`src/engine/PdfDocument.ts`) exposing `open(buffer, options)`, `pageCount`, `pageSize(pageIndex)`, and `close()`.
- Implemented Web Worker message protocol (`src/shared/protocol.ts`) and worker message processing loop (`src/workers/pdf.worker.ts`) executing all MuPDF WASM interactions in dedicated worker threads.
- Enforced zero-copy `Transferable` transfers for document buffers across thread boundaries (`buffer.byteLength === 0` verified upon transfer).
- Implemented typed errors (`src/shared/errors.ts`): `EncryptedNeedsPasswordError`, `WrongPasswordError`, `CorruptFileError`, `TooLargeError` (configurable ceiling, default 200 MB), and `UnsupportedError`, with serialization across postMessage boundaries.
- Implemented in-memory synthetic PDF test generator (`tests/helpers/synthetic-pdf.ts`) supporting arbitrary page counts, dimensions, rotations, and RC4-128 encryption.
- Added comprehensive unit tests in `tests/unit/engine-facade.test.ts`:
  - Verified `buffer.byteLength === 0` immediately upon transfer to worker.
  - Verified `EncryptedNeedsPasswordError` on encrypted PDF without credentials.
  - Verified `WrongPasswordError` on invalid password.
  - Verified successful decryption and page counting with correct password.
  - Verified `CorruptFileError` on damaged/invalid buffers.
  - Verified `TooLargeError` when exceeding configured memory limit.
  - Verified 500-page synthetic PDF opens metadata-only without page rendering.
  - Verified `pageSize(i)` correctly returns dimensions in points honoring `/Rotate` (90°) and `CropBox`.
  - Verified memory and document release on `close()` (active document count dropped from 2 to 0, subsequent calls rejected, `mupdf.emptyStore()` called).

### Test Verification Results
- `pnpm check` (`eslint .`, `tsc --noEmit`, `vitest run`):
  - ESLint: 0 errors, 0 warnings.
  - Typecheck: 0 errors.
  - Vitest: 4 test files passed, 12 tests passed (440ms).
- `pnpm test:e2e`:
  - 1 passed (1.1s) on Chromium.
- `pnpm build`:
  - Production bundle & PWA service worker built cleanly (438ms).

### Dependencies Added
- None (leveraged existing dependencies).

### Open Questions
- None.

## Phase 1.2: Tile Renderer + Viewer (`branch: phase-1`)

### What Was Done
- **Tile Size Benchmark & ADR**: Evaluated 256×256 vs 512×512 tiles in MuPDF WASM (0.12ms vs 0.21ms per tile). Selected 256×256 px to guarantee tiles fit inside CPU L2 cache (256 KB per RGBA tile) and to provide fine-grained LRU eviction. Recorded in `docs/ADR-001-TILE-SIZE.md`.
- **LRU Tile Cache (`src/app/viewer/tile-cache.ts`)**: Implemented byte-bounded LRU cache with a default 128 MB budget (tracks `width * height * 4`). Evicted `ImageBitmap`s are immediately closed via `bitmap.close()`. Unit tested in `tests/unit/tile-cache.test.ts`.
- **Tile Rendering Protocol (`src/shared/protocol.ts`, `src/workers/pdf.worker.ts`)**: Added `PAGE_RENDER_TILE` action to worker. Renders tile with `mupdf.DrawDevice` and Compose matrix, transfers `ImageBitmap` zero-copy to main thread.
- **Virtualized Vertical Viewer (`src/app/viewer/`)**:
  - Implemented `PdfViewer` and `PageView` with viewport intersection culling (+ 1 viewport margin buffer).
  - Implemented generation token cancellation on scroll/zoom.
  - Canvas draws tiles via `drawImage(bitmap, dx, dy)` with zero main-thread `getImageData` calls.
  - Zoom controls: Fit-Width, Fit-Page, 25%–400%, keyboard shortcuts (`+`, `-`, `Ctrl+0`), and pinch/wheel zoom with `ctrlKey`.
  - Page number input and smooth scrolling.
- **E2E Acceptance Test (`tests/e2e/viewer.spec.ts`)**:
  - Opened 100-page synthetic PDF.
  - First page visible quickly (< 2000ms).
  - Virtualization confirmed: live page containers in DOM remained capped at <= 8 pages throughout continuous vertical scrolling to page 100.
  - Long Tasks API monitored: 0 long tasks over 50 ms attributable to application code during scrolling.
  - Zoom in/out and Fit Width verified.

### Test Verification Results
- `pnpm check`:
  - ESLint: 0 errors, 0 warnings.
  - Typecheck: 0 errors.
  - Vitest: 5 test files, 15 tests passed (577ms).
- `pnpm build`:
  - Production bundle & PWA service worker built cleanly (1.02s).
- `pnpm test:e2e`:
  - 2 passed (2.7s) on Chromium (`smoke.spec.ts` and `viewer.spec.ts`).

### Dependencies Added
- None (leveraged existing dependencies).

### Open Questions
- None.

## Phase 1.3: Thumbnail Sidebar (`branch: phase-1`)

### What Was Done
- **Thumbnail Rendering Protocol (`src/shared/protocol.ts`, `src/workers/pdf.worker.ts`)**: Added `PAGE_RENDER_THUMBNAIL` action. Renders whole-page low-resolution views (max dimension 140px, ~60 KB per thumbnail) off-thread, transferring `ImageBitmap` back to the main thread.
- **Virtualized Thumbnail Sidebar (`src/app/viewer/ThumbnailSidebar.tsx`)**:
  - Virtualized vertical thumbnail list with fixed 170px item slots. Computes visible range + 2 item buffer.
  - Even with a 500-page document, the number of mounted thumbnail items in the DOM is strictly bounded ($\le 15$ items; measured: 7 items).
  - High-priority viewport protection: thumbnail requests are scheduled at low priority via `requestIdleCallback` (with `setTimeout` fallback), ensuring thumbnail rendering never contends with main-viewport tile requests.
  - Synchronized active-page highlight ring (`rgb(26, 115, 232)` / `#1a73e8`).
  - Click-to-jump handler scrolling the main viewport smoothly to the clicked page.
  - Sidebar toggle button in `PdfViewer` toolbar (`☰ หน้าตัวอย่าง`).
- **E2E Acceptance Test (`tests/e2e/thumbnails.spec.ts`)**:
  - Opened 500-page synthetic PDF.
  - Verified main-viewport first page render latency remained undegraded: **316 ms** with thumbnails active.
  - Verified thumbnail DOM node count stayed capped at **7 items** (asserted $\le 15$).
  - Verified scrolling down sidebar to page 50, clicking thumbnail 50, and confirming main viewport and toolbar page number updated to 50.
  - Verified sidebar toggle hide/show.

### Test Verification Results
- `pnpm check`:
  - ESLint: 0 errors, 0 warnings.
  - Typecheck: 0 errors.
  - Vitest: 5 test files, 15 tests passed (556ms).
- `pnpm build`:
  - Production bundle & PWA service worker built cleanly (1.03s).
- `pnpm test:e2e`:
  - 3 passed (3.1s) on Chromium (`smoke.spec.ts`, `viewer.spec.ts`, `thumbnails.spec.ts`).

### Dependencies Added
- None (leveraged existing dependencies).

### Open Questions
- None.
