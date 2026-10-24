import * as mupdf from 'mupdf';

export interface SyntheticPdfOptions {
  pageCount?: number;
  width?: number;
  height?: number;
  rotate?: 0 | 90 | 180 | 270;
  password?: string;
}

/**
 * Generates synthetic PDF ArrayBuffers in-memory without external fixtures.
 */
export function createSyntheticPdf(options: SyntheticPdfOptions = {}): ArrayBuffer {
  const { pageCount = 1, width = 612, height = 792, rotate = 0, password } = options;

  const doc = new mupdf.PDFDocument();
  const mediabox: [number, number, number, number] = [0, 0, width, height];

  for (let i = 0; i < pageCount; i++) {
    const pageObj = doc.addPage(mediabox, rotate, mupdf.PDFObject.Null, new mupdf.Buffer());
    doc.insertPage(-1, pageObj);
  }

  const saveOpts = password
    ? `encrypt=rc4-128,user-password=${password},owner-password=${password}`
    : '';

  const buffer = doc.saveToBuffer(saveOpts);
  return buffer.asUint8Array().slice().buffer;
}
