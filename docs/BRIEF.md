# Project: Thai-first PDF Web Toolkit

## Purpose
Personal tool for the owner and friends. Non-commercial. No accounts, no analytics.

## Hard constraints
- Client-only: all processing in the browser via WebAssembly. No backend. Files never leave the device.
- Static deployment (Cloudflare Pages / GitHub Pages). Installable PWA.
- Stack: TypeScript, React, Vite. Engine: MuPDF.js (WASM). Rendering: pdf.js or MuPDF.
- All PDF parsing/rendering runs in Web Workers; main thread must never block.
- Licence note: MuPDF is AGPL; keep source available to users.

## Thai-first requirements
- Correct shaping of Thai (combining vowels/tone marks) via HarfBuzz WASM (harfbuzzjs)
  before writing any new text into a PDF. Never rely on pdf-lib without shaping.
- Word segmentation via Intl.Segmenter('th').
- Detect and repair broken ToUnicode CMaps (legacy Thai fonts / PUA mappings);
  fall back to OCR when text layer is unreliable.
- Embed full fonts (Noto Sans Thai, Sarabun; OFL) when adding or editing text,
  because embedded fonts are subsets.
- OCR for Thai producing a searchable PDF (invisible text layer, render mode 3,
  correct ToUnicode). Benchmark candidate engines by Character Error Rate after
  Unicode NFC + Thai mark-order normalization.

## Performance requirements
- Render in fixed-size tiles; virtualize thumbnails (only visible pages).
- Use Transferable objects; avoid structured-clone copies of large buffers.
- Image preprocessing (deskew, binarization) in WASM SIMD, branchless, row-major
  or tiled access for cache locality.
- Worker pool size <= navigator.hardwareConcurrency - 1.
- Per-file memory ceiling (default 200 MB) with graceful failure.
- Cache OCR models in Cache API / IndexedDB.

## Security
- Parsers inside Workers; PDF JavaScript disabled.
- Redaction must remove underlying content, not overlay shapes.
- Test corpus must contain NO real personal documents (synthetic/public files only).

## Phases
0 Foundation + architecture + Thai test corpus
1 Viewer + merge/split/rotate/reorder/delete pages
1.5 Thai text foundation (shaping, fonts, segmentation, ToUnicode repair)
2 Annotations, signature, form filling, redaction
3 Thai OCR -> searchable PDF
4 Edit existing text (redact old run + insert shaped text in embedded full font)

## Definition of done (every task)
Lint + typecheck + tests pass; round-trip test (open -> edit -> save -> reopen
in pdf.js and one other viewer) passes where relevant; summary of changes and
open questions written to docs/LOG.md.