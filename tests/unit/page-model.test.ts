import { describe, it, expect } from 'vitest';
import { PageListModel } from '../../src/engine/page-model';

describe('Sub-task 1.4: PageListModel & Operations', () => {
  it('initializes from document with correct default non-destructive properties', () => {
    const model = PageListModel.fromDocument('doc_1', 5);
    expect(model.pages.length).toBe(5);
    expect(model.getActivePages().length).toBe(5);

    const first = model.pages[0];
    expect(first).toBeDefined();
    expect(first?.sourceDocId).toBe('doc_1');
    expect(first?.sourcePageIndex).toBe(0);
    expect(first?.rotationDelta).toBe(0);
    expect(first?.deleted).toBe(false);
  });

  it('rotates selected pages by 90°, 180°, and -90° (270°)', () => {
    const model = PageListModel.fromDocument('doc_1', 3);
    const p0 = model.pages[0]!.id;
    const p1 = model.pages[1]!.id;

    // Rotate page 0 and 1 by 90 CW
    model.rotatePages([p0, p1], 90);
    expect(model.getEntryById(p0)?.rotationDelta).toBe(90);
    expect(model.getEntryById(p1)?.rotationDelta).toBe(90);
    expect(model.pages[2]?.rotationDelta).toBe(0);

    // Rotate page 0 by another 180 -> 270
    model.rotatePages([p0], 180);
    expect(model.getEntryById(p0)?.rotationDelta).toBe(270);

    // Rotate page 0 by -90 (CCW) -> 180
    model.rotatePages([p0], -90);
    expect(model.getEntryById(p0)?.rotationDelta).toBe(180);
  });

  it('deletes and restores pages non-destructively', () => {
    const model = PageListModel.fromDocument('doc_1', 4);
    const p1 = model.pages[1]!.id;

    expect(model.getActivePages().length).toBe(4);

    model.deletePages([p1]);
    expect(model.getEntryById(p1)?.deleted).toBe(true);
    expect(model.getActivePages().length).toBe(3);
    expect(model.getActivePages().map((p) => p.id)).not.toContain(p1);

    model.restorePages([p1]);
    expect(model.getEntryById(p1)?.deleted).toBe(false);
    expect(model.getActivePages().length).toBe(4);
  });

  it('reorders pages before and after target IDs', () => {
    const model = PageListModel.fromDocument('doc_1', 4); // p0, p1, p2, p3
    const p0 = model.pages[0]!.id;
    const p2 = model.pages[2]!.id;
    const p3 = model.pages[3]!.id;

    // Move p3 before p0 -> p3, p0, p1, p2
    model.movePages([p3], p0, 'before');
    expect(model.pages.map((p) => p.id)).toEqual([p3, p0, model.pages[2]!.id, p2]);

    // Move p0 after p2 -> p3, p1, p2, p0
    model.movePages([p0], p2, 'after');
    expect(model.pages.map((p) => p.id)).toEqual([p3, model.pages[1]!.id, p2, p0]);
  });

  it('moves pages up and down relative to active list', () => {
    const model = PageListModel.fromDocument('doc_1', 4);
    const ids = model.pages.map((p) => p.id);

    // Move item 2 up -> should swap with item 1
    model.movePagesRelative([ids[2]!], 'up');
    expect(model.pages.map((p) => p.id)).toEqual([ids[0], ids[2], ids[1], ids[3]]);

    // Move item 0 down -> should swap with item 2
    model.movePagesRelative([ids[0]!], 'down');
    expect(model.pages.map((p) => p.id)).toEqual([ids[2], ids[0], ids[1], ids[3]]);
  });

  it('extracts selection as a new detached PageEntry list', () => {
    const model = PageListModel.fromDocument('doc_1', 4);
    const ids = model.pages.map((p) => p.id);

    model.deletePages([ids[2]!]);

    // Extract pages 0, 1, 2 (page 2 is deleted so should be excluded from active extraction)
    const extracted = model.extractSelection([ids[0]!, ids[1]!, ids[2]!]);
    expect(extracted.length).toBe(2);
    expect(extracted.map((p) => p.id)).toEqual([ids[0], ids[1]]);
  });

  it('guarantees round-trip undo/redo for arbitrary sequences of operations', () => {
    const model = PageListModel.fromDocument('doc_test', 6);
    const originalSnapshot = JSON.stringify(model.pages);

    const ids = model.pages.map((p) => p.id);

    // 1. Rotate pages
    model.rotatePages([ids[0]!, ids[2]!], 90);
    // 2. Delete a page
    model.deletePages([ids[1]!]);
    // 3. Move page 5 to beginning
    model.movePages([ids[5]!], ids[0]!, 'before');
    // 4. Rotate page 4 by 180
    model.rotatePages([ids[4]!], 180);
    // 5. Move page 3 down
    model.movePagesRelative([ids[3]!], 'down');

    expect(JSON.stringify(model.pages)).not.toBe(originalSnapshot);

    // Perform full undo
    while (model.canUndo) {
      model.undo();
    }

    // Must return to exact initial state
    expect(JSON.stringify(model.pages)).toBe(originalSnapshot);

    // Redo all operations
    while (model.canRedo) {
      model.redo();
    }

    // Undo all operations once more
    while (model.canUndo) {
      model.undo();
    }

    expect(JSON.stringify(model.pages)).toBe(originalSnapshot);
  });
});
