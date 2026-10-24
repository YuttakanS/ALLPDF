/**
 * Normalizes a filename to Unicode NFC form and sanitizes invalid filename characters
 * for Windows and POSIX file systems ([<>:"/\\|?*\x00-\x1F]).
 * Preserves Thai characters, spaces, and alphanumeric characters.
 */
export function sanitizePdfFilename(rawName: string, defaultName = 'document.pdf'): string {
  if (!rawName) return defaultName;

  // 1. Normalize Unicode to NFC
  let normalized = rawName.normalize('NFC').trim();

  // 2. Remove characters that are illegal in Windows / POSIX file names
  // Illegal: < > : " / \ | ? * and ASCII control characters (0-31)
  // eslint-disable-next-line no-control-regex
  normalized = normalized.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');

  // 3. Remove trailing dots or spaces which are invalid in Windows
  normalized = normalized.replace(/[. ]+$/, '');

  if (!normalized) {
    return defaultName;
  }

  // 4. Ensure .pdf extension
  if (!normalized.toLowerCase().endsWith('.pdf')) {
    normalized += '.pdf';
  }

  return normalized;
}
