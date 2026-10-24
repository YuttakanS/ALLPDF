# PDF Engine Contract (`src/engine`)

## Overview

The `PdfDocument` class provides the main-thread facade for interacting with PDF documents.
All heavy operations (parsing, layout, tile rendering, export) execute in dedicated Web Workers.
Buffers crossing thread boundaries MUST use Transferable semantics (`ArrayBuffer`, `ImageBitmap`) to maintain zero-copy data transfer.

## Interface

```typescript
export interface PageSize {
  /** Width in points (1/72 inch), taking rotation and CropBox into account */
  width: number;
  /** Height in points (1/72 inch), taking rotation and CropBox into account */
  height: number;
  /** Effective page rotation (0, 90, 180, 270) */
  rotate: number;
}

export interface TileRenderRequest {
  pageIndex: number;
  /** Tile bounding box on canvas [x, y, width, height] in CSS pixels */
  bounds: { x: number; y: number; width: number; height: number };
  /** Target tile pixel size (e.g., 256x256 or 512x512) */
  tileSize: number;
  /** Scale factor (zoom * devicePixelRatio) */
  scale: number;
  /** Cancellation / generation token */
  generation: number;
}

export interface IPdfDocument {
  readonly pageCount: number;
  pageSize(pageIndex: number): Promise<PageSize>;
  renderTile(request: TileRenderRequest): Promise<ImageBitmap>;
  close(): Promise<void>;
}
```

## Typed Errors

All failures originating from worker or engine boundaries must be mapped to distinct typed error classes:

1. `EncryptedNeedsPassword`: Thrown when a PDF is encrypted and requires a password to open.
2. `WrongPassword`: Thrown when the supplied password fails authentication.
3. `CorruptFile`: Thrown when the PDF header, xref table, or stream is unrecoverably damaged.
4. `TooLarge`: Thrown when document size exceeds the configured memory ceiling (default 200 MB).
5. `Unsupported`: Thrown when PDF features/compression schemes are unsupported by the engine.

## Memory Management

- Calling `close()` must immediately instruct the backing worker to release document handles, drop internal MuPDF caches, and terminate or reset the worker context.
