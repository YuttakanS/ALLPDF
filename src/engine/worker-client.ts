import { deserializeError } from '../shared/errors';
import type {
  DocCloseResult,
  DocOpenResult,
  DocPageSizeResult,
  PageSize,
  WorkerAction,
  WorkerRequestEnvelope,
  WorkerResponseEnvelope,
} from '../shared/protocol';

export interface IWorkerTransport {
  postMessage(message: WorkerRequestEnvelope, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerResponseEnvelope>) => void) | null;
  terminate?: () => void;
}

export class WorkerClient {
  private transport: IWorkerTransport;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
    }
  >();
  private messageCounter = 0;

  constructor(transport?: IWorkerTransport) {
    let workerInstance: Worker | null = null;
    if (transport) {
      this.transport = transport;
    } else {
      // Create standard Web Worker under Vite
      const worker = new Worker(new URL('../workers/pdf.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerInstance = worker;
      this.transport = worker as unknown as IWorkerTransport;
    }

    this.transport.onmessage = (event: MessageEvent<WorkerResponseEnvelope>) => {
      this.handleMessage(event.data);
    };

    if (workerInstance) {
      workerInstance.onerror = (e) => {
        console.error('[WORKER ONERROR]:', e.message, e);
        for (const [id, req] of this.pendingRequests.entries()) {
          req.reject(new Error(`Worker execution failed: ${e.message}`));
          this.pendingRequests.delete(id);
        }
      };
    }
  }

  private handleMessage(response: WorkerResponseEnvelope): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    this.pendingRequests.delete(response.id);

    if (response.success) {
      pending.resolve(response.result);
    } else if (response.error) {
      pending.reject(deserializeError(response.error));
    } else {
      pending.reject(new Error('Unknown worker error'));
    }
  }

  private nextId(): string {
    return `req_${++this.messageCounter}_${Date.now()}`;
  }

  send<TPayload, TResult>(
    action: WorkerAction,
    payload: TPayload,
    transferList: Transferable[] = []
  ): Promise<TResult> {
    const id = this.nextId();
    const envelope: WorkerRequestEnvelope<TPayload> = {
      id,
      action,
      payload,
    };

    return new Promise<TResult>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (val: unknown) => void,
        reject,
      });

      try {
        this.transport.postMessage(envelope as WorkerRequestEnvelope, transferList);
      } catch (err) {
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  async openDoc(
    docId: string,
    buffer: ArrayBuffer,
    password?: string,
    maxBytes?: number
  ): Promise<DocOpenResult> {
    // Zero-copy transfer: buffer is transferred to the worker thread
    return this.send(
      'DOC_OPEN',
      { docId, buffer, password, maxBytes },
      [buffer]
    );
  }

  async pageSize(docId: string, pageIndex: number): Promise<PageSize> {
    const res = await this.send<
      { docId: string; pageIndex: number },
      DocPageSizeResult
    >('DOC_PAGE_SIZE', { docId, pageIndex });
    return res.size;
  }

  async renderTile(payload: import('../shared/protocol').PageRenderTilePayload): Promise<import('../shared/protocol').PageRenderTileResult> {
    return this.send('PAGE_RENDER_TILE', payload);
  }

  async closeDoc(docId: string): Promise<DocCloseResult> {
    return this.send('DOC_CLOSE', { docId });
  }

  terminate(): void {
    if (this.transport.terminate) {
      this.transport.terminate();
    }
    this.pendingRequests.clear();
  }
}
