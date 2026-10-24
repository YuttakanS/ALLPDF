/// <reference lib="webworker" />

import type { WorkerRequest, EchoTransferPayload } from '../shared/types';

self.onmessage = (event: MessageEvent<WorkerRequest<EchoTransferPayload>>) => {
  const { id, type, payload } = event.data;
  if (type === 'ECHO_TRANSFER') {
    const { buffer, timestamp } = payload;
    // Echo back the buffer with zero-copy transfer
    self.postMessage(
      {
        id,
        type: 'ECHO_TRANSFER_REPLY',
        success: true,
        payload: {
          buffer,
          timestamp,
          receivedByteLength: buffer.byteLength,
        },
      },
      [buffer]
    );
  }
};
