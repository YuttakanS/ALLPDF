import { sanitizePdfFilename } from './filename';

export interface SaveFileResult {
  method: 'file-system-access' | 'blob-download';
  filename: string;
}

/**
 * Saves or downloads a PDF buffer using the browser File System Access API (showSaveFilePicker)
 * if available, falling back seamlessly to Blob + object URL download.
 */
export async function saveOrDownloadPdf(
  data: ArrayBuffer | Uint8Array,
  suggestedFilename: string
): Promise<SaveFileResult> {
  const normalizedFilename = sanitizePdfFilename(suggestedFilename);
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  // 1. Try File System Access API (showSaveFilePicker) where supported
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker({
        suggestedName: normalizedFilename,
        types: [
          {
            description: 'PDF Document (*.pdf)',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(bytes as unknown as BufferSource);
      await writable.close();
      return { method: 'file-system-access', filename: normalizedFilename };
    } catch (err: unknown) {
      // If user intentionally canceled picker (AbortError), don't trigger fallback download
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      // Otherwise fall through to Blob anchor fallback
    }
  }

  // 2. Fallback to Blob + <a> anchor download
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = normalizedFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { method: 'blob-download', filename: normalizedFilename };
}
