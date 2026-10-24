import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as mupdf from 'mupdf';
import {
  PdfDocument,
  WorkerClient,
  PageListModel,
  sanitizePdfFilename,
  type IWorkerTransport,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
  type PageExportSpec,
} from '../../src/engine';
import { processWorkerRequest } from '../../src/workers/pdf.worker';

class NodeWorkerTransport implements IWorkerTransport {
  onmessage: ((event: MessageEvent<WorkerResponseEnvelope>) => void) | null = null;

  postMessage(message: WorkerRequestEnvelope): void {
    setTimeout(async () => {
      const res = await processWorkerRequest(message);
      if (this.onmessage) {
        this.onmessage({ data: res.reply } as MessageEvent<WorkerResponseEnvelope>);
      }
    }, 0);
  }
}

describe('Sub-task 1.6: Export, Metadata & Round-trip Verification', () => {
  describe('Filename Normalization & Sanitization', () => {
    it('preserves Thai filenames and normalizes to NFC', () => {
      const rawThai = 'รายงานการประชุม_๒๕๖๗.pdf';
      const sanitized = sanitizePdfFilename(rawThai);
      expect(sanitized).toBe('รายงานการประชุม_๒๕๖๗.pdf');
      // Assert NFC normalization
      expect(sanitized).toBe(sanitized.normalize('NFC'));
    });

    it('sanitizes only invalid Windows and POSIX filename characters', () => {
      const input = 'เอกสาร:ทดสอบ/ฉบับร่าง*<v1>?|\\".pdf';
      const sanitized = sanitizePdfFilename(input);
      expect(sanitized).toBe('เอกสารทดสอบฉบับร่างv1.pdf');
      expect(sanitized).not.toMatch(/[<>:"/\\|?*]/);
    });

    it('appends .pdf if missing and trims trailing periods/spaces', () => {
      expect(sanitizePdfFilename('รายงานประจำปี...  ')).toBe('รายงานประจำปี.pdf');
      expect(sanitizePdfFilename('document')).toBe('document.pdf');
      expect(sanitizePdfFilename('   ')).toBe('document.pdf');
    });
  });

  describe('Round-trip Verification (Our Engine & pdf.js)', () => {
    const corpusPath = path.resolve('test-corpus/public/thai_embedded_sample.pdf');

    it('round-trips exported PDF containing Thai text and embedded fonts through both our engine and pdf.js', async () => {
      expect(fs.existsSync(corpusPath)).toBe(true);
      const corpusBuffer = fs.readFileSync(corpusPath);

      const client = new WorkerClient(new NodeWorkerTransport());
      const doc = await PdfDocument.open(corpusBuffer.buffer.slice(0), { client });

      expect(doc.pageCount).toBe(2);

      // Model: Page 0 has rotation delta 90°, Page 1 kept as-is
      const model = PageListModel.fromDocument(doc.docId, 2);
      model.rotatePages([`${doc.docId}_p0`], 90);

      const activePages = model.getActivePages();
      const exportSpecs: PageExportSpec[] = activePages.map((p) => ({
        sourceDocId: p.sourceDocId,
        sourcePageIndex: p.sourcePageIndex,
        rotationDelta: p.rotationDelta,
      }));

      // 1. Export PDF using engine worker
      const exportResult = await doc.exportPages(exportSpecs);
      expect(exportResult.buffer.byteLength).toBeGreaterThan(0);

      // 2. Reopen with OUR ENGINE
      const reopenedDoc = await PdfDocument.open(exportResult.buffer.slice(0), { client });
      expect(reopenedDoc.pageCount).toBe(2);

      // Original page 0 was 612x792 with rotate 0. With rotationDelta 90, pageSize() swaps width/height
      const sizePage0 = await reopenedDoc.pageSize(0);
      expect(sizePage0.rotate).toBe(90);
      expect(sizePage0.width).toBeCloseTo(792, 0);
      expect(sizePage0.height).toBeCloseTo(612, 0);

      // Original page 1 was 792x612 with rotate 90. RotationDelta 0 -> stays rotate 90
      const sizePage1 = await reopenedDoc.pageSize(1);
      expect(sizePage1.rotate).toBe(90);

      // 3. Reopen with PDF.JS (test-only dev dependency)
      const pdfjsDoc = await pdfjsLib.getDocument({
        data: new Uint8Array(exportResult.buffer.slice(0)),
      }).promise;

      expect(pdfjsDoc.numPages).toBe(2);

      // Verify metadata preserved in pdf.js
      const pdfjsMeta = await pdfjsDoc.getMetadata();
      const info = pdfjsMeta.info as Record<string, unknown>;
      expect(info.Title).toBe('เอกสารทดสอบภาษาไทย');
      expect(info.Author).toBe('ALLPDF Toolkit');

      // Verify page sizes and rotations in pdf.js
      const pdfjsPage1 = await pdfjsDoc.getPage(1);
      expect(pdfjsPage1.rotate).toBe(90);
      expect(pdfjsPage1.view[2]).toBeCloseTo(612, 0);
      expect(pdfjsPage1.view[3]).toBeCloseTo(792, 0);

      const pdfjsPage2 = await pdfjsDoc.getPage(2);
      expect(pdfjsPage2.rotate).toBe(90);
      expect(pdfjsPage2.view[2]).toBeCloseTo(792, 0);
      expect(pdfjsPage2.view[3]).toBeCloseTo(612, 0);

      // 4. Pixel-diff of rendered pages against baseline with stated tolerance
      // Render baseline with MuPDF
      const origMupdf = new mupdf.PDFDocument(corpusBuffer);
      const baselinePage0 = origMupdf.loadPage(0);
      // Baseline page 0 rotated 90 degrees
      const rotMatrix = mupdf.Matrix.rotate(90);
      const baselinePixmap = baselinePage0.toPixmap(rotMatrix, mupdf.ColorSpace.DeviceRGB, false);
      const baselinePixels = baselinePixmap.getPixels();

      // Render exported page 0 with MuPDF
      const exportedMupdf = new mupdf.PDFDocument(exportResult.buffer.slice(0));
      const exportedPage0 = exportedMupdf.loadPage(0);
      // The exported page 0 already has /Rotate 90, so identity matrix renders it rotated
      const exportedPixmap = exportedPage0.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false);
      const exportedPixels = exportedPixmap.getPixels();

      expect(exportedPixels.length).toBe(baselinePixels.length);

      let diffBytes = 0;
      for (let i = 0; i < baselinePixels.length; i++) {
        if (Math.abs((baselinePixels[i] ?? 0) - (exportedPixels[i] ?? 0)) > 2) {
          diffBytes++;
        }
      }

      // Stated tolerance: pixel difference must be < 0.05%
      const diffPercent = (diffBytes / baselinePixels.length) * 100;
      console.log(`[PERF] Export pixel-diff percent: ${diffPercent.toFixed(4)}% (diffBytes: ${diffBytes})`);
      expect(diffPercent).toBeLessThan(0.05);

      await doc.close();
      await reopenedDoc.close();
      await pdfjsDoc.cleanup();
    });
  });
});
