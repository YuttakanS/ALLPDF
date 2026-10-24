import type { SerializedPdfError } from './errors';

export interface PageSize {
  /** Width in points (1/72 inch), honoring CropBox and /Rotate */
  width: number;
  /** Height in points (1/72 inch), honoring CropBox and /Rotate */
  height: number;
  /** Normalized page rotation in degrees (0, 90, 180, 270) */
  rotate: number;
}

export type WorkerAction =
  | 'DOC_OPEN'
  | 'DOC_PAGE_SIZE'
  | 'DOC_CLOSE'
  | 'PAGE_RENDER_TILE'
  | 'PAGE_RENDER_THUMBNAIL'
  | 'DOC_EXPORT_PAGES';

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

export interface PageRenderTilePayload {
  docId: string;
  pageIndex: number;
  tileX: number; // in points
  tileY: number; // in points
  tileW: number; // in pixels
  tileH: number; // in pixels
  scale: number; // zoom * dpr
  generation: number;
}

export interface PageRenderTileResult {
  docId: string;
  pageIndex: number;
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
  scale: number;
  generation: number;
  bitmap?: ImageBitmap;
  rawBuffer?: ArrayBuffer;
}

export interface PageRenderThumbnailPayload {
  docId: string;
  pageIndex: number;
  maxDim?: number; // e.g. 140 px
}

export interface PageRenderThumbnailResult {
  docId: string;
  pageIndex: number;
  width: number;
  height: number;
  bitmap?: ImageBitmap;
  rawBuffer?: ArrayBuffer;
}

export interface PageExportSpec {
  sourceDocId: string;
  sourcePageIndex: number;
  rotationDelta: number;
}

export interface DocExportPagesPayload {
  pages: PageExportSpec[];
}

export interface ExportWarning {
  code: 'OUTLINES_DROPPED' | 'METADATA_MERGED' | 'LINKS_DROPPED';
  messageEn: string;
  messageTh: string;
}

export interface DocExportPagesResult {
  buffer: ArrayBuffer;
  warnings?: ExportWarning[];
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
