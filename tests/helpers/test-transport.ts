import type { IWorkerTransport } from '../../src/engine/worker-client';
import type { WorkerRequestEnvelope, WorkerResponseEnvelope } from '../../src/shared/protocol';
import { processWorkerRequest } from '../../src/workers/pdf.worker';

/**
 * Worker transport for Node/Vitest that uses native MessageChannel to enforce
 * genuine zero-copy Transferable buffer detachment (buffer.byteLength becomes 0).
 */
export class NodeWorkerTransport implements IWorkerTransport {
  onmessage: ((event: MessageEvent<WorkerResponseEnvelope>) => void) | null = null;
  private isTerminated = false;

  postMessage(message: WorkerRequestEnvelope, transfer?: Transferable[]): void {
    if (this.isTerminated) return;

    const channel = new MessageChannel();

    channel.port2.onmessage = async (event: MessageEvent<WorkerRequestEnvelope>) => {
      if (this.isTerminated) return;
      const { reply } = await processWorkerRequest(event.data);
      if (this.onmessage && !this.isTerminated) {
        this.onmessage(new MessageEvent('message', { data: reply }));
      }
    };

    if (transfer && transfer.length > 0) {
      channel.port1.postMessage(message, transfer);
    } else {
      channel.port1.postMessage(message);
    }
  }

  terminate(): void {
    this.isTerminated = true;
  }
}
