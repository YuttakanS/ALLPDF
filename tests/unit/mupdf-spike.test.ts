import { describe, it, expect } from 'vitest';
import { Worker } from 'node:worker_threads';

describe('MuPDF In-Memory PDF Worker Feasibility Spike', () => {
  it('initializes mupdf in a worker thread, creates a PDF, and returns page count', async () => {
    const workerScript = `
      import { parentPort } from 'node:worker_threads';
      import * as mupdf from 'mupdf';

      async function run() {
        try {
          const doc = new mupdf.PDFDocument();
          const pageObj = doc.addPage([0, 0, 612, 792], 0, mupdf.PDFObject.Null, new mupdf.Buffer());
          doc.insertPage(-1, pageObj);
          const pageCount = doc.countPages();
          parentPort.postMessage({ success: true, pageCount });
        } catch (err) {
          parentPort.postMessage({ success: false, error: String(err) });
        }
      }
      run();
    `;

    const worker = new Worker(workerScript, { eval: true });

    const resultPromise = new Promise<{ success: boolean; pageCount?: number; error?: string }>(
      (resolve) => {
        worker.on('message', (msg) => resolve(msg));
        worker.on('error', (err) => resolve({ success: false, error: err.message }));
      }
    );

    const result = await resultPromise;
    expect(result.success).toBe(true);
    expect(result.pageCount).toBe(1);

    await worker.terminate();
  });
});
