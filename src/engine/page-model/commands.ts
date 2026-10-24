import type { ICommand, PageEntry, RotationDegree } from './types';
import type { PageListModel } from './PageListModel';

export class RotatePagesCommand implements ICommand {
  readonly description: string;
  private model: PageListModel;
  private pageIds: string[];
  private degrees: number; // e.g. 90, -90, 180
  private previousRotations = new Map<string, RotationDegree>();

  constructor(model: PageListModel, pageIds: string[], degrees: number) {
    this.model = model;
    this.pageIds = pageIds;
    this.degrees = degrees;
    this.description = `Rotate ${pageIds.length} page(s) by ${degrees}°`;

    for (const id of pageIds) {
      const entry = model.getEntryById(id);
      if (entry) {
        this.previousRotations.set(id, entry.rotationDelta);
      }
    }
  }

  execute(): void {
    for (const id of this.pageIds) {
      const entry = this.model.getEntryById(id);
      if (entry) {
        const newRot = (((entry.rotationDelta + this.degrees) % 360) + 360) % 360;
        entry.rotationDelta = newRot as RotationDegree;
      }
    }
    this.model.notifyChange();
  }

  undo(): void {
    for (const [id, prevRot] of this.previousRotations.entries()) {
      const entry = this.model.getEntryById(id);
      if (entry) {
        entry.rotationDelta = prevRot;
      }
    }
    this.model.notifyChange();
  }
}

export class DeletePagesCommand implements ICommand {
  readonly description: string;
  private model: PageListModel;
  private pageIds: string[];
  private previousStates = new Map<string, boolean>();

  constructor(model: PageListModel, pageIds: string[]) {
    this.model = model;
    this.pageIds = pageIds;
    this.description = `Delete ${pageIds.length} page(s)`;

    for (const id of pageIds) {
      const entry = model.getEntryById(id);
      if (entry) {
        this.previousStates.set(id, entry.deleted);
      }
    }
  }

  execute(): void {
    for (const id of this.pageIds) {
      const entry = this.model.getEntryById(id);
      if (entry) {
        entry.deleted = true;
      }
    }
    this.model.notifyChange();
  }

  undo(): void {
    for (const [id, prevDeleted] of this.previousStates.entries()) {
      const entry = this.model.getEntryById(id);
      if (entry) {
        entry.deleted = prevDeleted;
      }
    }
    this.model.notifyChange();
  }
}

export class RestorePagesCommand implements ICommand {
  readonly description: string;
  private model: PageListModel;
  private pageIds: string[];
  private previousStates = new Map<string, boolean>();

  constructor(model: PageListModel, pageIds: string[]) {
    this.model = model;
    this.pageIds = pageIds;
    this.description = `Restore ${pageIds.length} page(s)`;

    for (const id of pageIds) {
      const entry = model.getEntryById(id);
      if (entry) {
        this.previousStates.set(id, entry.deleted);
      }
    }
  }

  execute(): void {
    for (const id of this.pageIds) {
      const entry = this.model.getEntryById(id);
      if (entry) {
        entry.deleted = false;
      }
    }
    this.model.notifyChange();
  }

  undo(): void {
    for (const [id, prevDeleted] of this.previousStates.entries()) {
      const entry = this.model.getEntryById(id);
      if (entry) {
        entry.deleted = prevDeleted;
      }
    }
    this.model.notifyChange();
  }
}

export class MovePagesCommand implements ICommand {
  readonly description: string;
  private model: PageListModel;
  private pageIds: string[];
  private targetId: string;
  private position: 'before' | 'after';
  private previousPages: PageEntry[];

  constructor(
    model: PageListModel,
    pageIds: string[],
    targetId: string,
    position: 'before' | 'after' = 'before'
  ) {
    this.model = model;
    this.pageIds = pageIds;
    this.targetId = targetId;
    this.position = position;
    this.description = `Move ${pageIds.length} page(s) ${position} page ${targetId}`;
    this.previousPages = [...model.pages];
  }

  execute(): void {
    const pages = [...this.model.pages];
    const idSet = new Set(this.pageIds);

    // Extract items to move (maintaining their relative ordering)
    const itemsToMove = pages.filter((p) => idSet.has(p.id));
    const remaining = pages.filter((p) => !idSet.has(p.id));

    // Find insertion index relative to target
    const targetIdx = remaining.findIndex((p) => p.id === this.targetId);
    if (targetIdx === -1) {
      // If target not found in remaining, append to end
      this.model.setPages([...remaining, ...itemsToMove]);
      return;
    }

    const insertIdx = this.position === 'before' ? targetIdx : targetIdx + 1;
    remaining.splice(insertIdx, 0, ...itemsToMove);

    this.model.setPages(remaining);
  }

  undo(): void {
    this.model.setPages([...this.previousPages]);
  }
}

export class AddDocumentPagesCommand implements ICommand {
  readonly description: string;
  private model: PageListModel;
  private newEntries: PageEntry[];

  constructor(model: PageListModel, sourceDocId: string, pageCount: number) {
    this.model = model;
    this.description = `Add document ${sourceDocId} (${pageCount} pages)`;
    this.newEntries = [];
    for (let i = 0; i < pageCount; i++) {
      this.newEntries.push({
        id: `${sourceDocId}_p${i}`,
        sourceDocId,
        sourcePageIndex: i,
        rotationDelta: 0,
        deleted: false,
      });
    }
  }

  execute(): void {
    const current = [...this.model.pages, ...this.newEntries];
    this.model.setPages(current);
  }

  undo(): void {
    const idsToRemove = new Set(this.newEntries.map((e) => e.id));
    const reverted = this.model.pages.filter((p) => !idsToRemove.has(p.id));
    this.model.setPages(reverted);
  }
}

export class RemoveDocumentCommand implements ICommand {
  readonly description: string;
  private model: PageListModel;
  private sourceDocId: string;
  private previousPages: PageEntry[];

  constructor(model: PageListModel, sourceDocId: string) {
    this.model = model;
    this.sourceDocId = sourceDocId;
    this.description = `Remove document ${sourceDocId}`;
    this.previousPages = [...model.pages];
  }

  execute(): void {
    const updated = this.model.pages.filter((p) => p.sourceDocId !== this.sourceDocId);
    this.model.setPages(updated);
  }

  undo(): void {
    this.model.setPages(this.previousPages);
  }
}
