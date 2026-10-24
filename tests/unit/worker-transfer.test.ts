import { describe, it, expect } from 'vitest';
import { Worker } from 'node:worker_threads';

describe('Worker Transferable Zero-Copy Round-Trip', () => {
  it('transfers an ArrayBuffer with byteLength becoming 0 on the sender', async () => {
    const workerScript = `
      import { parentPort } from 'node:worker_threads';
      parentPort.on('message', (msg) => {
        const { buffer } = msg;
        // Verify buffer has arrived intact
        const view = new Uint8Array(buffer);
        view[0] = 42;
        // Transfer it back
        parentPort.postMessage({ buffer, length: buffer.byteLength }, [buffer]);
      });
    `;

    const worker = new Worker(workerScript, { eval: true });

    const buffer = new ArrayBuffer(1024);
    const view = new Uint8Array(buffer);
    view[0] = 7;

    expect(buffer.byteLength).toBe(1024);

    const receivedPromise = new Promise<{ buffer: ArrayBuffer; length: number }>((resolve) => {
      worker.on('message', (msg) => {
        resolve(msg);
      });
    });

    // Post message with buffer in transferList
    worker.postMessage({ buffer }, [buffer]);

    // Zero-copy transfer rule: buffer.byteLength becomes 0 immediately on sender
    expect(buffer.byteLength).toBe(0);

    const result = await receivedPromise;
    expect(result.length).toBe(1024);
    expect(new Uint8Array(result.buffer)[0]).toBe(42);

    await worker.terminate();
  });
});
