# Project Tasks Roadmap

## Phase 0: Foundation + Architecture + Thai Test Corpus
- [x] Initial repository scaffolding (pnpm, Vite, React, TS, Vitest, Playwright, ESLint, Prettier)
- [x] COOP/COEP isolation & Web Worker / WASM configuration
- [x] Smoke tests (Intl Thai segmentation, Worker round-trip with Transferable, MuPDF spike, Playwright crossOriginIsolated)
- [ ] Phase 0 Architecture specifications & typed contracts
- [ ] Curate synthetic Thai test corpus (public domain / synthetic PDFs covering edge cases)

## Phase 1: Viewer & Basic Manipulation
- [ ] Tile rendering engine with virtualization
- [ ] Merge, split, rotate, reorder, delete pages

## Phase 1.5: Thai Text Foundation
- [ ] HarfBuzz WASM shaping integration
- [ ] Thai word segmentation and line breaking
- [ ] ToUnicode CMap repair & PUA remapping
- [ ] OFL font embedding (Noto Sans Thai, Sarabun)

## Phase 2: Annotations, Signatures, Forms, Redaction
- [ ] Vector annotations & digital signatures
- [ ] Form filling & flattening
- [ ] True content redaction (destructively removing underlying vector/text streams)

## Phase 3: Thai OCR to Searchable PDF
- [ ] WASM SIMD image preprocessing
- [ ] Thai OCR model benchmarking & integration
- [ ] Invisible text layer generation (render mode 3)

## Phase 4: Text Editing
- [ ] Redact old text run + insert shaped text in embedded font
