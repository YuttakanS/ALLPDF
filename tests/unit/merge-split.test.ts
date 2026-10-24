import { describe, it, expect } from 'vitest';
import * as fflate from 'fflate';
import * as mupdf from 'mupdf';
import {
  parsePageRanges,
  splitEveryNPages,
  splitSelectedPages,
  executeSplit,
  PageListModel,
  PdfDocument,
  WorkerClient,
  type PageExportSpec,
} from '../../src/engine';
import { createSyntheticPdf } from '../helpers/synthetic-pdf';
import { processWorkerRequest } from '../../src/workers/pdf.worker';
import type { IWorkerTransport, WorkerRequestEnvelope, WorkerResponseEnvelope } from '../../src/engine';

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

describe('Sub-task 1.5: Merge and Split Unit Tests', () => {
  describe('Split Range Parser & Validator', () => {
    it('correctly parses valid mixed page ranges', () => {
      const res = parsePageRanges('1-3, 5, 8-', 10);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.groups).toHaveLength(3);
        expect(res.groups[0]?.name).toBe('pages_1-3.pdf');
        expect(res.groups[0]?.pageIndices).toEqual([0, 1, 2]);

        expect(res.groups[1]?.name).toBe('page_5.pdf');
        expect(res.groups[1]?.pageIndices).toEqual([4]);

        expect(res.groups[2]?.name).toBe('pages_8-10.pdf');
        expect(res.groups[2]?.pageIndices).toEqual([7, 8, 9]);
      }
    });

    it('correctly parses open-start range "-4"', () => {
      const res = parsePageRanges('-4', 8);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.groups).toHaveLength(1);
        expect(res.groups[0]?.name).toBe('pages_1-4.pdf');
        expect(res.groups[0]?.pageIndices).toEqual([0, 1, 2, 3]);
      }
    });

    it('rejects empty input with clear bilingual error messages', () => {
      const res = parsePageRanges('   ', 10);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.messageEn).toMatch(/cannot be empty/i);
        expect(res.error.messageTh).toMatch(/ไม่สามารถเว้นว่างได้/);
      }
    });

    it('rejects out of bounds ranges without silent clamping', () => {
      // Document has 8 pages, user asks for 10
      const res1 = parsePageRanges('10', 8);
      expect(res1.success).toBe(false);
      if (!res1.success) {
        expect(res1.error.messageEn).toContain('Page number 10 is out of bounds (1-8)');
        expect(res1.error.messageTh).toContain('หมายเลขหน้า 10 อยู่นอกช่วงที่ถูกต้อง (1-8)');
      }

      // Range end out of bounds
      const res2 = parsePageRanges('2-9', 8);
      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.error.messageEn).toContain('End page 9 is out of bounds (1-8)');
        expect(res2.error.messageTh).toContain('หน้าสิ้นสุด 9 อยู่นอกช่วงที่ถูกต้อง (1-8)');
      }

      // Open end start out of bounds
      const res3 = parsePageRanges('9-', 8);
      expect(res3.success).toBe(false);
      if (!res3.success) {
        expect(res3.error.messageEn).toContain('Start page 9 is out of bounds (1-8)');
        expect(res3.error.messageTh).toContain('หน้าเริ่มต้น 9 อยู่นอกช่วงที่ถูกต้อง (1-8)');
      }
    });

    it('rejects inverted ranges (start > end)', () => {
      const res = parsePageRanges('5-3', 10);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.messageEn).toContain('start page cannot be greater than end page');
        expect(res.error.messageTh).toContain('หน้าเริ่มต้นต้องไม่มากกว่าหน้าสิ้นสุด');
      }
    });

    it('rejects non-positive and invalid tokens', () => {
      const res0 = parsePageRanges('0-4', 10);
      expect(res0.success).toBe(false);
      if (!res0.success) {
        expect(res0.error.messageEn).toContain('Page numbers must be 1 or greater');
        expect(res0.error.messageTh).toContain('หมายเลขหน้าต้องเริ่มจาก 1 ขึ้นไป');
      }

      const resInvalid = parsePageRanges('abc', 10);
      expect(resInvalid.success).toBe(false);
      if (!resInvalid.success) {
        expect(resInvalid.error.messageEn).toContain('Invalid page range token "abc"');
        expect(resInvalid.error.messageTh).toContain('รูปแบบช่วงหน้าไม่ถูกต้อง "abc"');
      }
    });

    it('splits every N pages correctly', () => {
      const res = splitEveryNPages(10, 3);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.groups).toHaveLength(4);
        expect(res.groups[0]?.pageIndices).toEqual([0, 1, 2]);
        expect(res.groups[1]?.pageIndices).toEqual([3, 4, 5]);
        expect(res.groups[2]?.pageIndices).toEqual([6, 7, 8]);
        expect(res.groups[3]?.pageIndices).toEqual([9]);
      }
    });

    it('splits selected pages in individual and combined modes', () => {
      const resInd = splitSelectedPages([0, 3, 5], 10, 'individual');
      expect(resInd.success).toBe(true);
      if (resInd.success) {
        expect(resInd.groups).toHaveLength(3);
        expect(resInd.groups[0]?.pageIndices).toEqual([0]);
        expect(resInd.groups[1]?.pageIndices).toEqual([3]);
        expect(resInd.groups[2]?.pageIndices).toEqual([5]);
      }

      const resComb = splitSelectedPages([0, 3, 5], 10, 'combined');
      expect(resComb.success).toBe(true);
      if (resComb.success) {
        expect(resComb.groups).toHaveLength(1);
        expect(resComb.groups[0]?.pageIndices).toEqual([0, 3, 5]);
      }
    });
  });

  describe('Merge & Model Operations', () => {
    it('merges A(3p) + B(5p) yielding 8 pages in the right order', () => {
      const model = PageListModel.fromDocument('docA', 3);
      expect(model.getActivePages()).toHaveLength(3);

      model.addDocumentPages('docB', 5);
      const active = model.getActivePages();
      expect(active).toHaveLength(8);

      // Verify order: docA pages 0,1,2 followed by docB pages 0,1,2,3,4
      for (let i = 0; i < 3; i++) {
        expect(active[i]?.sourceDocId).toBe('docA');
        expect(active[i]?.sourcePageIndex).toBe(i);
      }
      for (let i = 0; i < 5; i++) {
        expect(active[3 + i]?.sourceDocId).toBe('docB');
        expect(active[3 + i]?.sourcePageIndex).toBe(i);
      }

      // Undo merges: removes docB pages
      model.undo();
      expect(model.getActivePages()).toHaveLength(3);

      // Redo merges: restores docB pages
      model.redo();
      expect(model.getActivePages()).toHaveLength(8);
    });

    it('supports per-file collapse and remove with undo', () => {
      const model = PageListModel.fromDocument('docA', 3);
      model.addDocumentPages('docB', 4);

      expect(model.isDocCollapsed('docA')).toBe(false);
      model.toggleDocCollapse('docA');
      expect(model.isDocCollapsed('docA')).toBe(true);

      expect(model.getDocumentIds()).toEqual(['docA', 'docB']);

      // Remove docA
      model.removeDocument('docA');
      expect(model.getActivePages()).toHaveLength(4);
      expect(model.getActivePages()[0]?.sourceDocId).toBe('docB');

      // Undo remove
      model.undo();
      expect(model.getActivePages()).toHaveLength(7);
      expect(model.getActivePages()[0]?.sourceDocId).toBe('docA');
    });
  });

  describe('Worker Export & ZIP Splitting Roundtrip', () => {
    it('exports merged documents preserving mixed page sizes and rotations', async () => {
      const client = new WorkerClient(new NodeWorkerTransport());

      // Create Doc A with 3 pages (612x792, rotation 0)
      const rawA = createSyntheticPdf({ pageCount: 3, width: 612, height: 792, rotate: 0 });
      const docA = await PdfDocument.open(rawA, { client });

      // Create Doc B with 5 pages (500x700, rotation 90)
      const rawB = createSyntheticPdf({ pageCount: 5, width: 500, height: 700, rotate: 90 });
      const docB = await PdfDocument.open(rawB, { client });

      // Build export specs for A(3p) + B(5p)
      const specs: PageExportSpec[] = [];
      for (let i = 0; i < 3; i++) {
        specs.push({ sourceDocId: docA.docId, sourcePageIndex: i, rotationDelta: 0 });
      }
      for (let i = 0; i < 5; i++) {
        specs.push({ sourceDocId: docB.docId, sourcePageIndex: i, rotationDelta: 90 });
      }

      const exportedBuffer = await docA.exportPages(specs);
      expect(exportedBuffer.byteLength).toBeGreaterThan(0);

      // Verify exported document using MuPDF directly
      const verifyDoc = new mupdf.PDFDocument(exportedBuffer);
      expect(verifyDoc.countPages()).toBe(8);

      // Verify page sizes and rotations preserved
      const page0Bounds = verifyDoc.loadPage(0).getBounds();
      expect(page0Bounds[2]).toBeCloseTo(612, 0);
      expect(page0Bounds[3]).toBeCloseTo(792, 0);

      // Page 3 came from docB (originally rotated 90, plus 90 rotationDelta = 180)
      const page3 = verifyDoc.loadPage(3);
      const page3Obj = page3.getObject();
      expect(page3Obj.get('Rotate')?.valueOf()).toBe(180);

      await docA.close();
      await docB.close();
    });

    it('splits into multiple outputs bundled as a valid .zip archive', async () => {
      const transport = new NodeWorkerTransport();
      const raw = createSyntheticPdf({ pageCount: 6, width: 612, height: 792 });
      const doc = await PdfDocument.open(raw, { transport });

      const model = PageListModel.fromDocument(doc.docId, 6);
      const splitResult = parsePageRanges('1-2, 3-4, 5-6', 6);
      expect(splitResult.success).toBe(true);

      if (splitResult.success) {
        const output = await executeSplit(
          model.getActivePages(),
          splitResult.groups,
          (specs) => doc.exportPages(specs),
          'test_split'
        );

        expect(output.type).toBe('zip');
        expect(output.filename).toBe('test_split.zip');
        expect(output.data.byteLength).toBeGreaterThan(0);

        // Unzip and verify contents with fflate
        const unzipped = fflate.unzipSync(output.data);
        const fileNames = Object.keys(unzipped);
        expect(fileNames).toContain('pages_1-2.pdf');
        expect(fileNames).toContain('pages_3-4.pdf');
        expect(fileNames).toContain('pages_5-6.pdf');

        // Verify each extracted PDF has exactly 2 pages
        for (const name of fileNames) {
          const fileData = unzipped[name];
          expect(fileData).toBeDefined();
          if (fileData) {
            const partDoc = new mupdf.PDFDocument(fileData.buffer);
            expect(partDoc.countPages()).toBe(2);
          }
        }
      }

      await doc.close();
    });
  });
});
