import { describe, it, expect } from 'vitest';
import {
  CorruptFileError,
  EncryptedNeedsPasswordError,
  PdfDocument,
  TooLargeError,
  WrongPasswordError,
} from '../../src/engine';
import { getActiveDocCount } from '../../src/workers/pdf.worker';
import { createSyntheticPdf } from '../helpers/synthetic-pdf';
import { NodeWorkerTransport } from '../helpers/test-transport';

describe('Sub-task 1.1: PDF Engine Facade & Worker Protocol', () => {
  it('opens a PDF and enforces zero-copy Transferable buffer detachment', async () => {
    const raw = createSyntheticPdf({ pageCount: 3 });
    expect(raw.byteLength).toBeGreaterThan(0);

    const doc = await PdfDocument.open(raw, { transport: new NodeWorkerTransport() });

    // Zero-copy guarantee: buffer was transferred and detached on caller
    expect(raw.byteLength).toBe(0);
    expect(doc.pageCount).toBe(3);

    await doc.close();
  });

  it('throws EncryptedNeedsPasswordError when opening password-protected PDF without password', async () => {
    const raw = createSyntheticPdf({ pageCount: 1, password: 'correct_horse_battery' });

    await expect(
      PdfDocument.open(raw, { transport: new NodeWorkerTransport() })
    ).rejects.toThrow(EncryptedNeedsPasswordError);
  });

  it('throws WrongPasswordError when incorrect password is provided', async () => {
    const raw = createSyntheticPdf({ pageCount: 1, password: 'correct_horse_battery' });

    await expect(
      PdfDocument.open(raw, {
        password: 'incorrect_password',
        transport: new NodeWorkerTransport(),
      })
    ).rejects.toThrow(WrongPasswordError);
  });

  it('opens encrypted PDF successfully when correct password is provided', async () => {
    const password = 'mySecretPassword123';
    const raw = createSyntheticPdf({ pageCount: 2, password });

    const doc = await PdfDocument.open(raw, {
      password,
      transport: new NodeWorkerTransport(),
    });

    expect(doc.pageCount).toBe(2);
    await doc.close();
  });

  it('throws CorruptFileError for corrupted or invalid byte sequences', async () => {
    const corruptBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).buffer;

    await expect(
      PdfDocument.open(corruptBuffer, { transport: new NodeWorkerTransport() })
    ).rejects.toThrow(CorruptFileError);
  });

  it('throws TooLargeError when file size exceeds configurable maxBytes ceiling', async () => {
    const raw = createSyntheticPdf({ pageCount: 1 });
    const maxBytes = 100; // artificially low limit

    await expect(
      PdfDocument.open(raw, {
        maxBytes,
        transport: new NodeWorkerTransport(),
      })
    ).rejects.toThrow(TooLargeError);
  });

  it('opens a 500-page synthetic PDF and reports pageCount without rendering any page', async () => {
    const start = performance.now();
    const raw = createSyntheticPdf({ pageCount: 500, width: 595.28, height: 841.89 }); // A4
    const doc = await PdfDocument.open(raw, { transport: new NodeWorkerTransport() });
    const elapsed = performance.now() - start;

    expect(doc.pageCount).toBe(500);
    // Opening 500 pages metadata-only should finish in a few hundred milliseconds
    expect(elapsed).toBeLessThan(3000);

    await doc.close();
  });

  it('retrieves pageSize in points honoring /Rotate and CropBox', async () => {
    // 612 x 792 rotated 90 degrees cw -> effective size is 792 x 612, rotate = 90
    const raw = createSyntheticPdf({ pageCount: 1, width: 612, height: 792, rotate: 90 });
    const doc = await PdfDocument.open(raw, { transport: new NodeWorkerTransport() });

    const size = await doc.pageSize(0);
    expect(size.rotate).toBe(90);
    expect(size.width).toBe(792);
    expect(size.height).toBe(612);

    await doc.close();
  });

  it('releases document and memory after close()', async () => {
    const initialActive = getActiveDocCount();

    const raw1 = createSyntheticPdf({ pageCount: 5 });
    const doc1 = await PdfDocument.open(raw1, { transport: new NodeWorkerTransport() });

    const raw2 = createSyntheticPdf({ pageCount: 5 });
    const doc2 = await PdfDocument.open(raw2, { transport: new NodeWorkerTransport() });

    expect(getActiveDocCount()).toBe(initialActive + 2);

    await doc1.close();
    expect(getActiveDocCount()).toBe(initialActive + 1);
    expect(doc1.isClosed).toBe(true);

    // Attempting operations on closed document must reject
    await expect(doc1.pageSize(0)).rejects.toThrow(/closed/);

    await doc2.close();
    expect(getActiveDocCount()).toBe(initialActive);
    expect(doc2.isClosed).toBe(true);
  });
});
