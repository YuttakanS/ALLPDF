import type { PageExportSpec, PageSize } from '../shared/protocol';
import {
  WorkerClient,
  type IWorkerTransport,
  getDefaultWorkerClient,
} from './worker-client';

export interface OpenPdfOptions {
  password?: string;
  maxBytes?: number;
  transport?: IWorkerTransport;
  client?: WorkerClient;
  isolated?: boolean;
}

export class PdfDocument {
  private readonly _docId: string;
  private readonly _pageCount: number;
  private readonly _client: WorkerClient;
  private readonly _ownsClient: boolean;
  private _isClosed = false;

  private constructor(
    docId: string,
    pageCount: number,
    client: WorkerClient,
    ownsClient = false
  ) {
    this._docId = docId;
    this._pageCount = pageCount;
    this._client = client;
    this._ownsClient = ownsClient;
  }

  get docId(): string {
    return this._docId;
  }

  get pageCount(): number {
    return this._pageCount;
  }

  get isClosed(): boolean {
    return this._isClosed;
  }

  get client(): WorkerClient {
    return this._client;
  }

  /**
   * Opens a PDF from an ArrayBuffer using zero-copy transfer to the worker.
   * The buffer is transferred (buffer.byteLength becomes 0 on the caller).
   */
  static async open(buffer: ArrayBuffer, options?: OpenPdfOptions): Promise<PdfDocument> {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const ownsClient = Boolean(options?.transport || options?.isolated);
    const client =
      options?.client ??
      (ownsClient ? new WorkerClient(options?.transport) : getDefaultWorkerClient());

    try {
      const { pageCount } = await client.openDoc(
        docId,
        buffer,
        options?.password,
        options?.maxBytes
      );
      return new PdfDocument(docId, pageCount, client, ownsClient);
    } catch (err) {
      if (ownsClient) {
        client.terminate();
      }
      throw err;
    }
  }

  /**
   * Retrieves page dimensions in points, honoring /Rotate and CropBox.
   */
  async pageSize(pageIndex: number): Promise<PageSize> {
    if (this._isClosed) {
      throw new Error(`Cannot get page size: document ${this._docId} has been closed.`);
    }
    return this._client.pageSize(this._docId, pageIndex);
  }

  /**
   * Renders a fixed-size tile off-thread, returning an ImageBitmap (transferred).
   */
  async renderTile(
    payload: Omit<import('../shared/protocol').PageRenderTilePayload, 'docId'>
  ): Promise<import('../shared/protocol').PageRenderTileResult> {
    if (this._isClosed) {
      throw new Error(`Cannot render tile: document ${this._docId} has been closed.`);
    }
    return this._client.renderTile({
      ...payload,
      docId: this._docId,
    });
  }

  /**
   * Renders a low-resolution thumbnail image off-thread at low priority.
   */
  async renderThumbnail(
    pageIndex: number,
    maxDim = 140
  ): Promise<import('../shared/protocol').PageRenderThumbnailResult> {
    if (this._isClosed) {
      throw new Error(`Cannot render thumbnail: document ${this._docId} has been closed.`);
    }
    return this._client.renderThumbnail({
      docId: this._docId,
      pageIndex,
      maxDim,
    });
  }

  /**
   * Builds an output PDF containing the specified page references across open documents.
   */
  async exportPages(pages: PageExportSpec[]): Promise<ArrayBuffer> {
    if (this._isClosed) {
      throw new Error(`Cannot export pages: document ${this._docId} has been closed.`);
    }
    return this._client.exportPages(pages);
  }

  /**
   * Closes the document, releases worker handles and memory, and terminates the worker session if owned.
   */
  async close(): Promise<void> {
    if (this._isClosed) return;
    this._isClosed = true;
    try {
      await this._client.closeDoc(this._docId);
    } finally {
      if (this._ownsClient) {
        this._client.terminate();
      }
    }
  }
}
