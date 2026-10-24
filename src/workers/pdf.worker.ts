import * as mupdf from 'mupdf';
import {
  CorruptFileError,
  EncryptedNeedsPasswordError,
  TooLargeError,
  WrongPasswordError,
  serializeError,
} from '../shared/errors';
import type {
  DocClosePayload,
  DocCloseResult,
  DocOpenPayload,
  DocOpenResult,
  DocPageSizePayload,
  DocPageSizeResult,
  WorkerRequestEnvelope,
  WorkerResponseEnvelope,
} from '../shared/protocol';

const DEFAULT_MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const activeDocs = new Map<string, mupdf.PDFDocument>();

export function getActiveDocCount(): number {
  return activeDocs.size;
}

export async function processWorkerRequest(
  request: WorkerRequestEnvelope
): Promise<{ reply: WorkerResponseEnvelope; transfers?: Transferable[] }> {
  const { id, action } = request;

  try {
    switch (action) {
      case 'DOC_OPEN': {
        const payload = request.payload as DocOpenPayload;
        const maxBytes = payload.maxBytes ?? DEFAULT_MAX_BYTES;

        if (payload.buffer.byteLength > maxBytes) {
          throw new TooLargeError(payload.buffer.byteLength, maxBytes);
        }

        if (payload.buffer.byteLength < 8) {
          throw new CorruptFileError('File size is too small to contain a valid PDF structure.');
        }

        let doc: mupdf.PDFDocument;
        try {
          doc = new mupdf.PDFDocument(payload.buffer);
        } catch (err: unknown) {
          throw new CorruptFileError(err instanceof Error ? err.message : String(err));
        }

        if (doc.needsPassword()) {
          if (!payload.password) {
            throw new EncryptedNeedsPasswordError();
          }
          const authResult = doc.authenticatePassword(payload.password);
          if (authResult === 0) {
            throw new WrongPasswordError();
          }
        }

        activeDocs.set(payload.docId, doc);
        const pageCount = doc.countPages();

        const result: DocOpenResult = {
          docId: payload.docId,
          pageCount,
        };

        return {
          reply: { id, action, success: true, result },
        };
      }

      case 'DOC_PAGE_SIZE': {
        const payload = request.payload as DocPageSizePayload;
        const doc = activeDocs.get(payload.docId);
        if (!doc) {
          throw new CorruptFileError(`Document ${payload.docId} is not loaded or has been closed.`);
        }

        if (payload.pageIndex < 0 || payload.pageIndex >= doc.countPages()) {
          throw new Error(`Page index ${payload.pageIndex} out of bounds (0..${doc.countPages() - 1}).`);
        }

        const page = doc.loadPage(payload.pageIndex);
        const bounds = page.getBounds(mupdf.Page.CROP_BOX);
        const width = Math.round(Math.abs(bounds[2] - bounds[0]) * 100) / 100;
        const height = Math.round(Math.abs(bounds[3] - bounds[1]) * 100) / 100;

        let rotate = 0;
        try {
          const rotObj = page.getObject().getInheritable('Rotate');
          if (rotObj && rotObj.isNumber()) {
            rotate = ((rotObj.asNumber() % 360) + 360) % 360;
          }
        } catch {
          rotate = 0;
        }

        const result: DocPageSizeResult = {
          docId: payload.docId,
          pageIndex: payload.pageIndex,
          size: { width, height, rotate },
        };

        return {
          reply: { id, action, success: true, result },
        };
      }

      case 'DOC_CLOSE': {
        const payload = request.payload as DocClosePayload;
        activeDocs.delete(payload.docId);

        // Instruct MuPDF WASM to clean up its cache store
        try {
          mupdf.emptyStore();
        } catch {
          // ignore cache clearing error on close
        }

        const result: DocCloseResult = {
          docId: payload.docId,
          closed: true,
        };

        return {
          reply: { id, action, success: true, result },
        };
      }

      default:
        throw new Error(`Unrecognized action: ${action}`);
    }
  } catch (err: unknown) {
    return {
      reply: {
        id,
        action,
        success: false,
        error: serializeError(err),
      },
    };
  }
}

// In standard Web Worker context, wire onmessage handler
if (typeof self !== 'undefined' && 'postMessage' in self && typeof WorkerGlobalScope !== 'undefined') {
  self.onmessage = async (event: MessageEvent<WorkerRequestEnvelope>) => {
    const { reply, transfers } = await processWorkerRequest(event.data);
    if (transfers && transfers.length > 0) {
      self.postMessage(reply, transfers);
    } else {
      self.postMessage(reply);
    }
  };
}
