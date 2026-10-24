import { CommandManager } from './CommandManager';
import {
  AddDocumentPagesCommand,
  DeletePagesCommand,
  MovePagesCommand,
  RemoveDocumentCommand,
  RestorePagesCommand,
  RotatePagesCommand,
} from './commands';
import type { PageEntry } from './types';

export class PageListModel {
  private _pages: PageEntry[] = [];
  private commandManager: CommandManager;
  private listeners = new Set<() => void>();
  private _collapsedDocs = new Set<string>();

  constructor(entries: PageEntry[] = [], historyLimit = 100) {
    this._pages = entries.map((e) => ({ ...e }));
    this.commandManager = new CommandManager(historyLimit);
    this.commandManager.subscribe(() => this.notifyChange());
  }

  static fromDocument(sourceDocId: string, pageCount: number): PageListModel {
    const entries: PageEntry[] = [];
    for (let i = 0; i < pageCount; i++) {
      entries.push({
        id: `${sourceDocId}_p${i}`,
        sourceDocId,
        sourcePageIndex: i,
        rotationDelta: 0,
        deleted: false,
      });
    }
    return new PageListModel(entries);
  }

  get pages(): readonly PageEntry[] {
    return this._pages;
  }

  setPages(newPages: PageEntry[]): void {
    this._pages = newPages;
    this.notifyChange();
  }

  getEntryById(id: string): PageEntry | undefined {
    return this._pages.find((p) => p.id === id);
  }

  getActivePages(): PageEntry[] {
    return this._pages.filter((p) => !p.deleted);
  }

  get canUndo(): boolean {
    return this.commandManager.canUndo;
  }

  get canRedo(): boolean {
    return this.commandManager.canRedo;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  rotatePages(pageIds: string[], degrees: 90 | -90 | 180): void {
    if (pageIds.length === 0) return;
    this.commandManager.execute(new RotatePagesCommand(this, pageIds, degrees));
  }

  deletePages(pageIds: string[]): void {
    if (pageIds.length === 0) return;
    this.commandManager.execute(new DeletePagesCommand(this, pageIds));
  }

  restorePages(pageIds: string[]): void {
    if (pageIds.length === 0) return;
    this.commandManager.execute(new RestorePagesCommand(this, pageIds));
  }

  movePages(
    pageIds: string[],
    targetId: string,
    position: 'before' | 'after' = 'before'
  ): void {
    if (pageIds.length === 0 || pageIds.includes(targetId)) return;
    this.commandManager.execute(new MovePagesCommand(this, pageIds, targetId, position));
  }

  movePagesRelative(pageIds: string[], direction: 'up' | 'down'): void {
    const activePages = this.getActivePages();
    if (pageIds.length === 0 || activePages.length <= 1) return;

    const idSet = new Set(pageIds);
    if (direction === 'up') {
      const firstActiveIdx = activePages.findIndex((p) => idSet.has(p.id));
      if (firstActiveIdx <= 0) return;

      const target = activePages[firstActiveIdx - 1];
      if (target) {
        this.movePages(pageIds, target.id, 'before');
      }
    } else {
      let lastActiveIdx = -1;
      for (let i = activePages.length - 1; i >= 0; i--) {
        const p = activePages[i];
        if (p && idSet.has(p.id)) {
          lastActiveIdx = i;
          break;
        }
      }

      if (lastActiveIdx === -1 || lastActiveIdx >= activePages.length - 1) return;

      const target = activePages[lastActiveIdx + 1];
      if (target) {
        this.movePages(pageIds, target.id, 'after');
      }
    }
  }

  addDocumentPages(sourceDocId: string, pageCount: number): void {
    this.commandManager.execute(new AddDocumentPagesCommand(this, sourceDocId, pageCount));
  }

  removeDocument(sourceDocId: string): void {
    this.commandManager.execute(new RemoveDocumentCommand(this, sourceDocId));
  }

  getDocumentIds(): string[] {
    const docIds: string[] = [];
    for (const page of this.getActivePages()) {
      if (!docIds.includes(page.sourceDocId)) {
        docIds.push(page.sourceDocId);
      }
    }
    return docIds;
  }

  isDocCollapsed(sourceDocId: string): boolean {
    return this._collapsedDocs.has(sourceDocId);
  }

  toggleDocCollapse(sourceDocId: string): void {
    if (this._collapsedDocs.has(sourceDocId)) {
      this._collapsedDocs.delete(sourceDocId);
    } else {
      this._collapsedDocs.add(sourceDocId);
    }
    this.notifyChange();
  }

  extractSelection(pageIds: string[]): PageEntry[] {
    const idSet = new Set(pageIds);
    return this.getActivePages()
      .filter((p) => idSet.has(p.id))
      .map((p) => ({ ...p }));
  }

  undo(): boolean {
    return this.commandManager.undo();
  }

  redo(): boolean {
    return this.commandManager.redo();
  }

  clearHistory(): void {
    this.commandManager.clear();
  }
}
