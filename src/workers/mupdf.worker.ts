/// <reference lib="webworker" />

import * as mupdf from 'mupdf';
import type { WorkerRequest, WorkerResponse, MuPdfSpikeResult } from '../shared/types';

self.onmessage = async (event: MessageEvent<WorkerRequest<void>>) => {
  const { id, type } = event.data;
  if (type === 'CREATE_SPIKE_PDF') {
    try {
      // Create a tiny PDF in memory
      const doc = new mupdf.PDFDocument();
      // Add a single blank letter-size page [0, 0, 612, 792]
      const pageObj = doc.addPage(
        [0, 0, 612, 792],
        0,
        mupdf.PDFObject.Null,
        new mupdf.Buffer()
      );
      doc.insertPage(-1, pageObj);

      const pageCount = doc.countPages();

      const response: WorkerResponse<MuPdfSpikeResult> = {
        id,
        type: 'CREATE_SPIKE_PDF_REPLY',
        success: true,
        payload: {
          pageCount,
          engine: 'mupdf-wasm',
        },
      };
      self.postMessage(response);
    } catch (err: unknown) {
      const response: WorkerResponse<MuPdfSpikeResult> = {
        id,
        type: 'CREATE_SPIKE_PDF_REPLY',
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
      self.postMessage(response);
    }
  }
};
