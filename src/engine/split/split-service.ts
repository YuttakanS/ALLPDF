import * as fflate from 'fflate';
import type { PageEntry } from '../page-model/types';
import type { PageExportSpec } from '../../shared/protocol';
import type { SplitGroup } from './range-parser';

export interface SplitOutput {
  type: 'pdf' | 'zip';
  filename: string;
  data: Uint8Array;
}

/**
 * Builds split output files from PageList active pages and SplitGroups.
 * If 1 group: returns single PDF Uint8Array.
 * If > 1 groups: bundles all PDFs into a single .zip file via fflate.
 */
export async function executeSplit(
  activePages: PageEntry[],
  groups: SplitGroup[],
  exportFn: (specs: PageExportSpec[]) => Promise<ArrayBuffer | { buffer: ArrayBuffer }>,
  baseName = 'split_document'
): Promise<SplitOutput> {
  if (groups.length === 0) {
    throw new Error('No split groups provided');
  }

  if (groups.length === 1) {
    const group = groups[0]!;
    const specs: PageExportSpec[] = group.pageIndices.map((idx) => {
      const page = activePages[idx];
      if (!page) {
        throw new Error(`Page index ${idx} not found in active pages`);
      }
      return {
        sourceDocId: page.sourceDocId,
        sourcePageIndex: page.sourcePageIndex,
        rotationDelta: page.rotationDelta,
      };
    });

    const res = await exportFn(specs);
    const buffer = 'buffer' in res ? res.buffer : res;
    return {
      type: 'pdf',
      filename: group.name,
      data: new Uint8Array(buffer),
    };
  }

  // Multiple groups -> zip bundle
  const zipFiles: Record<string, Uint8Array> = {};

  for (const group of groups) {
    const specs: PageExportSpec[] = group.pageIndices.map((idx) => {
      const page = activePages[idx];
      if (!page) {
        throw new Error(`Page index ${idx} not found in active pages`);
      }
      return {
        sourceDocId: page.sourceDocId,
        sourcePageIndex: page.sourcePageIndex,
        rotationDelta: page.rotationDelta,
      };
    });

    const res = await exportFn(specs);
    const buffer = 'buffer' in res ? res.buffer : res;
    zipFiles[group.name] = new Uint8Array(buffer);
  }

  const zipped = fflate.zipSync(zipFiles);
  return {
    type: 'zip',
    filename: `${baseName}.zip`,
    data: zipped,
  };
}

/**
 * Initiates browser file download via Blob + object URL anchor.
 */
export function downloadFile(output: SplitOutput): void {
  const mimeType = output.type === 'zip' ? 'application/zip' : 'application/pdf';
  const blob = new Blob([output.data as unknown as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = output.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
