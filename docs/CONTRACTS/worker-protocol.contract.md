# Worker Protocol Contract (`src/shared`)

## Message Protocol Architecture

The communication between the main-thread engine facade and Web Workers operates over a typed request-response message protocol.

### Message Structure

```typescript
export interface WorkerRequest<T = unknown> {
  id: string;
  type: string;
  payload: T;
}

export interface WorkerResponse<T = unknown> {
  id: string;
  type: string;
  success: boolean;
  payload?: T;
  error?: {
    code: 'EncryptedNeedsPassword' | 'WrongPassword' | 'CorruptFile' | 'TooLarge' | 'Unsupported' | 'InternalError';
    message: string;
  };
}
```

### Action Types

1. `DOC_OPEN`:
   - Payload: `{ buffer: ArrayBuffer, password?: string, maxBytes?: number }` (Transfers `buffer`)
   - Response: `{ pageCount: number, docId: string }`
2. `DOC_PAGE_SIZE`:
   - Payload: `{ docId: string, pageIndex: number }`
   - Response: `{ width: number, height: number, rotate: number }`
3. `PAGE_RENDER_TILE`:
   - Payload: `{ docId: string, pageIndex: number, bounds: Rect, scale: number, generation: number }`
   - Response: `{ imageBitmap: ImageBitmap, generation: number }` (Transfers `imageBitmap`)
4. `DOC_CLOSE`:
   - Payload: `{ docId: string }`
   - Response: `{ closed: boolean }`

### Zero-Copy Guarantee

All array buffers, image bitmaps, and byte payloads sent across the thread boundary MUST be included in the `transferList` argument of `postMessage`:
- Sending document data: `worker.postMessage(req, [req.payload.buffer])`
- Returning tile renders: `self.postMessage(res, [res.payload.imageBitmap])`
- Buffers MUST have `.byteLength === 0` on the sender immediately after transfer.
