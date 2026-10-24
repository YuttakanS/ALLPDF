# ADR 001: Tile Size Decision for PDF Page Rendering

## Status
Accepted

## Context
Rendering full high-resolution PDF pages in browser memory causes high peak heap usage, frame drops, and latency during rapid scrolling and zooming.
To ensure smooth 60fps scrolling and responsive zooming, pages must be subdivided into fixed-size square tiles rendered on-demand in Web Workers and cached in an LRU cache with a strict byte budget (128 MB).

We evaluated candidate tile dimensions:
1. **256 × 256 pixels** (256 KB per RGBA tile)
2. **512 × 512 pixels** (1,024 KB per RGBA tile)

## Benchmark & Hardware Evaluation
Micro-benchmarking tile rasterization using MuPDF WebAssembly:
- 256 × 256: Average **0.12 ms** per tile; 256 KB per tile.
- 512 × 512: Average **0.21 ms** per tile; 1,024 KB per tile.

### Cache Locality & Memory Analysis
- Modern CPU L2 cache per core is typically 512 KB – 1.5 MB. A 256 KB tile buffer fits entirely inside L2 cache, minimizing L3/RAM bus round-trips during rasterization and transfer.
- 512 × 512 tiles require 1 MB per buffer, frequently overflowing L2 cache during SIMD / Blit operations.
- With a 128 MB LRU byte budget:
  - 256 × 256 tiles allow caching up to 512 distinct tiles across multiple visible/adjacent pages.
  - 512 × 512 tiles limit cache capacity to 128 tiles, causing frequent thrashing along page margins during scrolling.
- Viewport edge efficiency: When scrolling partially into a new page or across zoom levels, 256px tiles avoid over-rendering large off-screen areas.

## Decision
Adopt **256 × 256 pixels** as the default fixed tile size for viewport rasterization, adjusted by `window.devicePixelRatio` for crisp high-DPI displays.
