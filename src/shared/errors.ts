export type ErrorCode =
  | 'EncryptedNeedsPassword'
  | 'WrongPassword'
  | 'CorruptFile'
  | 'TooLarge'
  | 'Unsupported'
  | 'InternalError';

export class PdfEngineError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = code;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EncryptedNeedsPasswordError extends PdfEngineError {
  constructor(message = 'Document is password-protected and requires a password to open.') {
    super('EncryptedNeedsPassword', message);
  }
}

export class WrongPasswordError extends PdfEngineError {
  constructor(message = 'The provided password is incorrect.') {
    super('WrongPassword', message);
  }
}

export class CorruptFileError extends PdfEngineError {
  constructor(message = 'The PDF document is corrupt or has an invalid structure.') {
    super('CorruptFile', message);
  }
}

export class TooLargeError extends PdfEngineError {
  readonly actualBytes: number;
  readonly maxBytes: number;

  constructor(actualBytes: number, maxBytes: number) {
    super(
      'TooLarge',
      `File size (${(actualBytes / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit of ${(maxBytes / 1024 / 1024).toFixed(2)} MB.`
    );
    this.actualBytes = actualBytes;
    this.maxBytes = maxBytes;
  }
}

export class UnsupportedError extends PdfEngineError {
  constructor(message = 'The document uses unsupported features or formats.') {
    super('Unsupported', message);
  }
}

export interface SerializedPdfError {
  code: ErrorCode;
  message: string;
  actualBytes?: number;
  maxBytes?: number;
}

export function serializeError(err: unknown): SerializedPdfError {
  if (err instanceof PdfEngineError) {
    return {
      code: err.code,
      message: err.message,
      actualBytes: err instanceof TooLargeError ? err.actualBytes : undefined,
      maxBytes: err instanceof TooLargeError ? err.maxBytes : undefined,
    };
  }

  const msg = err instanceof Error ? err.message : String(err);
  // Auto-detect known MuPDF error messages if not already wrapped
  if (msg.includes('cannot find version marker') || msg.includes('no objects found') || msg.includes('corrupted') || msg.includes('cannot open document')) {
    return { code: 'CorruptFile', message: msg };
  }

  return {
    code: 'InternalError',
    message: msg,
  };
}

export function deserializeError(err: SerializedPdfError): PdfEngineError {
  switch (err.code) {
    case 'EncryptedNeedsPassword':
      return new EncryptedNeedsPasswordError(err.message);
    case 'WrongPassword':
      return new WrongPasswordError(err.message);
    case 'CorruptFile':
      return new CorruptFileError(err.message);
    case 'TooLarge':
      return new TooLargeError(err.actualBytes ?? 0, err.maxBytes ?? 0);
    case 'Unsupported':
      return new UnsupportedError(err.message);
    default:
      return new PdfEngineError(err.code, err.message);
  }
}
