/**
 * Typed message protocol for Web Worker communication
 */

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
  error?: string;
}

export interface EchoTransferPayload {
  buffer: ArrayBuffer;
  timestamp: number;
}

export interface MuPdfSpikeResult {
  pageCount: number;
  engine: string;
}
