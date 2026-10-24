# Architecture Overview

## Goals & Constraints
- **Client-only:** All PDF processing, rendering, and OCR runs strictly within the browser using WebAssembly. No backend services or external telemetry.
- **Thai-First:** First-class support for Thai complex shaping, dictionary/ML segmentation, and ToUnicode CMap repair.
- **Non-blocking Main Thread:** Heavy operations (parsing, rendering, shaping, OCR) run off-thread inside Web Workers.
- **Zero-Copy Data Transfer:** Document buffers and image tiles transfer via `Transferable` objects (`ArrayBuffer`, `ImageBitmap`).
- **PWA & Offline:** Works fully offline via Service Worker; static hosting on Cloudflare Pages or GitHub Pages with COOP/COEP isolation.

## Component Layout
- `src/app`: React UI shell and user interaction controls.
- `src/engine`: Main thread facade providing async methods for PDF documents and pages.
- `src/workers`: Web Worker entry points handling MuPDF WASM execution.
- `src/thai`: Thai shaping (HarfBuzz), segmentation (`Intl.Segmenter`), and CMap repair.
- `src/ocr`: Image preprocessing and Thai OCR pipeline.
- `src/shared`: Message protocol contracts, type definitions, and error definitions.
