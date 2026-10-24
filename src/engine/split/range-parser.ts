export interface SplitRangeError {
  messageEn: string;
  messageTh: string;
}

export interface SplitGroup {
  name: string;
  pageIndices: number[]; // 0-based indices into active pages
}

export type SplitResult =
  | { success: true; groups: SplitGroup[] }
  | { success: false; error: SplitRangeError };

/**
 * Parses user-entered page ranges string (e.g. "1-3,5,8-", "-4") against totalActivePages.
 * Rejects any out-of-bounds or invalid ranges with bilingual error messages (English & Thai).
 * Never clamps silently.
 */
export function parsePageRanges(rangeStr: string, totalActivePages: number): SplitResult {
  const trimmed = rangeStr.trim();
  if (!trimmed) {
    return {
      success: false,
      error: {
        messageEn: 'Page range string cannot be empty',
        messageTh: 'กรุณาระบุช่วงหน้า ไม่สามารถเว้นว่างได้',
      },
    };
  }

  if (totalActivePages <= 0) {
    return {
      success: false,
      error: {
        messageEn: 'No active pages available to split',
        messageTh: 'ไม่มีหน้าเอกสารที่สามารถแบ่งได้',
      },
    };
  }

  const tokens = trimmed.split(',').map((t) => t.trim());
  const groups: SplitGroup[] = [];

  for (const token of tokens) {
    if (!token) {
      return {
        success: false,
        error: {
          messageEn: 'Empty page range token found (extra comma)',
          messageTh: 'พบส่วนของช่วงหน้าที่ว่าง (มีเครื่องหมายจุลภาคเกิน)',
        },
      };
    }

    // Pattern 1: Open end "A-" (e.g. "8-")
    const openEndMatch = token.match(/^(\d+)-$/);
    if (openEndMatch && openEndMatch[1]) {
      const start = parseInt(openEndMatch[1], 10);
      if (start < 1) {
        return {
          success: false,
          error: {
            messageEn: 'Page numbers must be 1 or greater',
            messageTh: 'หมายเลขหน้าต้องเริ่มจาก 1 ขึ้นไป',
          },
        };
      }
      if (start > totalActivePages) {
        return {
          success: false,
          error: {
            messageEn: `Start page ${start} is out of bounds (1-${totalActivePages})`,
            messageTh: `หน้าเริ่มต้น ${start} อยู่นอกช่วงที่ถูกต้อง (1-${totalActivePages})`,
          },
        };
      }

      const indices: number[] = [];
      for (let p = start; p <= totalActivePages; p++) {
        indices.push(p - 1);
      }
      groups.push({
        name: start === totalActivePages ? `page_${start}.pdf` : `pages_${start}-${totalActivePages}.pdf`,
        pageIndices: indices,
      });
      continue;
    }

    // Pattern 2: Open start "-B" (e.g. "-4")
    const openStartMatch = token.match(/^-(\d+)$/);
    if (openStartMatch && openStartMatch[1]) {
      const end = parseInt(openStartMatch[1], 10);
      if (end < 1) {
        return {
          success: false,
          error: {
            messageEn: 'Page numbers must be 1 or greater',
            messageTh: 'หมายเลขหน้าต้องเริ่มจาก 1 ขึ้นไป',
          },
        };
      }
      if (end > totalActivePages) {
        return {
          success: false,
          error: {
            messageEn: `End page ${end} is out of bounds (1-${totalActivePages})`,
            messageTh: `หน้าสิ้นสุด ${end} อยู่นอกช่วงที่ถูกต้อง (1-${totalActivePages})`,
          },
        };
      }

      const indices: number[] = [];
      for (let p = 1; p <= end; p++) {
        indices.push(p - 1);
      }
      groups.push({
        name: end === 1 ? `page_1.pdf` : `pages_1-${end}.pdf`,
        pageIndices: indices,
      });
      continue;
    }

    // Pattern 3: Range "A-B" (e.g. "1-3")
    const rangeMatch = token.match(/^(\d+)-(\d+)$/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);

      if (start < 1 || end < 1) {
        return {
          success: false,
          error: {
            messageEn: 'Page numbers must be 1 or greater',
            messageTh: 'หมายเลขหน้าต้องเริ่มจาก 1 ขึ้นไป',
          },
        };
      }
      if (start > totalActivePages) {
        return {
          success: false,
          error: {
            messageEn: `Start page ${start} is out of bounds (1-${totalActivePages})`,
            messageTh: `หน้าเริ่มต้น ${start} อยู่นอกช่วงที่ถูกต้อง (1-${totalActivePages})`,
          },
        };
      }
      if (end > totalActivePages) {
        return {
          success: false,
          error: {
            messageEn: `End page ${end} is out of bounds (1-${totalActivePages})`,
            messageTh: `หน้าสิ้นสุด ${end} อยู่นอกช่วงที่ถูกต้อง (1-${totalActivePages})`,
          },
        };
      }
      if (start > end) {
        return {
          success: false,
          error: {
            messageEn: `Invalid range "${start}-${end}": start page cannot be greater than end page`,
            messageTh: `ช่วงหน้าไม่ถูกต้อง "${start}-${end}": หน้าเริ่มต้นต้องไม่มากกว่าหน้าสิ้นสุด`,
          },
        };
      }

      const indices: number[] = [];
      for (let p = start; p <= end; p++) {
        indices.push(p - 1);
      }
      groups.push({
        name: start === end ? `page_${start}.pdf` : `pages_${start}-${end}.pdf`,
        pageIndices: indices,
      });
      continue;
    }

    // Pattern 4: Single page number "N" (e.g. "5")
    const singleMatch = token.match(/^(\d+)$/);
    if (singleMatch && singleMatch[1]) {
      const page = parseInt(singleMatch[1], 10);
      if (page < 1) {
        return {
          success: false,
          error: {
            messageEn: 'Page numbers must be 1 or greater',
            messageTh: 'หมายเลขหน้าต้องเริ่มจาก 1 ขึ้นไป',
          },
        };
      }
      if (page > totalActivePages) {
        return {
          success: false,
          error: {
            messageEn: `Page number ${page} is out of bounds (1-${totalActivePages})`,
            messageTh: `หมายเลขหน้า ${page} อยู่นอกช่วงที่ถูกต้อง (1-${totalActivePages})`,
          },
        };
      }

      groups.push({
        name: `page_${page}.pdf`,
        pageIndices: [page - 1],
      });
      continue;
    }

    // Unrecognized format
    return {
      success: false,
      error: {
        messageEn: `Invalid page range token "${token}"`,
        messageTh: `รูปแบบช่วงหน้าไม่ถูกต้อง "${token}"`,
      },
    };
  }

  return { success: true, groups };
}

/**
 * Splits document into chunks of every N pages.
 */
export function splitEveryNPages(totalActivePages: number, n: number): SplitResult {
  if (!Number.isInteger(n) || n < 1) {
    return {
      success: false,
      error: {
        messageEn: 'Page interval N must be an integer >= 1',
        messageTh: 'จำนวนหน้า N ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป',
      },
    };
  }

  if (totalActivePages <= 0) {
    return {
      success: false,
      error: {
        messageEn: 'No active pages available to split',
        messageTh: 'ไม่มีหน้าเอกสารที่สามารถแบ่งได้',
      },
    };
  }

  const groups: SplitGroup[] = [];
  let chunkIndex = 1;

  for (let start = 0; start < totalActivePages; start += n) {
    const end = Math.min(start + n, totalActivePages);
    const indices: number[] = [];
    for (let i = start; i < end; i++) {
      indices.push(i);
    }

    const startPage = start + 1;
    const endPage = end;
    const name =
      startPage === endPage
        ? `part_${chunkIndex}_page_${startPage}.pdf`
        : `part_${chunkIndex}_pages_${startPage}-${endPage}.pdf`;

    groups.push({
      name,
      pageIndices: indices,
    });
    chunkIndex++;
  }

  return { success: true, groups };
}

/**
 * Splits document based on selected page indices.
 */
export function splitSelectedPages(
  selectedIndices: number[],
  totalActivePages: number,
  mode: 'individual' | 'combined' = 'individual'
): SplitResult {
  if (selectedIndices.length === 0) {
    return {
      success: false,
      error: {
        messageEn: 'No pages selected for splitting',
        messageTh: 'ไม่ได้เลือกหน้าใดไว้สำหรับการแบ่งไฟล์',
      },
    };
  }

  // Check bounds
  for (const idx of selectedIndices) {
    if (idx < 0 || idx >= totalActivePages) {
      return {
        success: false,
        error: {
          messageEn: `Selected page index ${idx + 1} is out of bounds (1-${totalActivePages})`,
          messageTh: `หน้าที่เลือก ${idx + 1} อยู่นอกช่วงที่ถูกต้อง (1-${totalActivePages})`,
        },
      };
    }
  }

  const sorted = Array.from(new Set(selectedIndices)).sort((a, b) => a - b);

  if (mode === 'combined') {
    return {
      success: true,
      groups: [
        {
          name: 'selected_pages.pdf',
          pageIndices: sorted,
        },
      ],
    };
  }

  // Individual mode: one file per selected page
  const groups: SplitGroup[] = sorted.map((idx) => ({
    name: `page_${idx + 1}.pdf`,
    pageIndices: [idx],
  }));

  return { success: true, groups };
}
