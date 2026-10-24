import type { SerializedPdfError } from './errors';

export interface PageSize {
  /** Width in points (1/72 inch), honoring CropBox and /Rotate */
  width: number;
  /** Height in points (1/72 inch), honoring CropBox and /Rotate */
  height: number;
  /** Normalized page rotation in degrees (0, 90, 180, 270) */
  rotate: number;
}

export type WorkerAction = 'DOC_OPEN' | 'DOC_PAGE_SIZE' | 'DOC_CLOSE';

export interface DocOpenPayload {
  docId: string;
  buffer: ArrayBuffer;
  password?: string;
  maxBytes?: number;
}

export interface DocOpenResult {
  docId: string;
  pageCount: number;
}

export interface DocPageSizePayload {
  docId: string;
  pageIndex: number;
}

export interface DocPageSizeResult {
  docId: string;
  pageIndex: number;
  size: PageSize;
}

export interface DocClosePayload {
  docId: string;
}

export interface DocCloseResult {
  docId: string;
  closed: boolean;
}

export interface WorkerRequestEnvelope<T = unknown> {
  id: string;
  action: WorkerAction;
  payload: T;
}

export interface WorkerResponseEnvelope<T = unknown> {
  id: string;
  action: WorkerAction;
  success: boolean;
  result?: T;
  error?: SerializedPdfError;
}
