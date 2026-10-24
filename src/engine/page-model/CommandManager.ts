import type { ICommand } from './types';

export class CommandManager {
  private readonly historyLimit: number;
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private listeners = new Set<() => void>();

  constructor(historyLimit = 100) {
    this.historyLimit = historyLimit;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  execute(command: ICommand): void {
    command.execute();
    this.undoStack.push(command);

    if (this.undoStack.length > this.historyLimit) {
      this.undoStack.shift();
    }

    // Any new command clears the redo history
    this.redoStack = [];
    this.notify();
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    this.notify();
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.execute();
    this.undoStack.push(command);
    this.notify();
    return true;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
