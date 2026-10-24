export type RotationDegree = 0 | 90 | 180 | 270;

export interface PageEntry {
  /** Unique stable ID for drag-and-drop, keying, and selection tracking */
  id: string;
  /** Identifier of the source PDF document */
  sourceDocId: string;
  /** 0-based page index in the source PDF document */
  sourcePageIndex: number;
  /** Non-destructive rotation delta relative to the original PDF page */
  rotationDelta: RotationDegree;
  /** Non-destructive deletion flag (false = active/visible) */
  deleted: boolean;
}

export interface ICommand {
  readonly description: string;
  execute(): void;
  undo(): void;
}
