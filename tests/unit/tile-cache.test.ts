import { describe, it, expect, vi } from 'vitest';
import { TileCache } from '../../src/app/viewer/tile-cache';

function createMockBitmap(width = 256, height = 256): ImageBitmap {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap;
}

describe('TileCache (Byte-Bounded LRU Cache)', () => {
  it('tracks byte size accurately (width * height * 4)', () => {
    const cache = new TileCache(10 * 1024 * 1024); // 10 MB
    const bitmap = createMockBitmap(256, 256); // 256 * 256 * 4 = 262,144 bytes = 256 KB

    cache.set('tile_1', bitmap);
    expect(cache.bytesUsed).toBe(262144);
    expect(cache.size).toBe(1);
    expect(cache.get('tile_1')).toBe(bitmap);
  });

  it('evicts oldest entries when exceeding byte budget and calls close()', () => {
    // Budget for exactly 2 tiles (2 * 256 KB = 512 KB = 524,288 bytes)
    const twoTilesBudget = 2 * 256 * 256 * 4;
    const cache = new TileCache(twoTilesBudget);

    const b1 = createMockBitmap(256, 256);
    const b2 = createMockBitmap(256, 256);
    const b3 = createMockBitmap(256, 256);

    cache.set('t1', b1);
    cache.set('t2', b2);
    expect(cache.bytesUsed).toBe(twoTilesBudget);
    expect(cache.size).toBe(2);

    // Access t1 so t2 becomes the oldest entry
    expect(cache.get('t1')).toBe(b1);

    // Add t3; t2 should be evicted
    cache.set('t3', b3);

    expect(cache.size).toBe(2);
    expect(cache.has('t2')).toBe(false);
    expect(b2.close).toHaveBeenCalledTimes(1);
    expect(cache.has('t1')).toBe(true);
    expect(cache.has('t3')).toBe(true);
    expect(cache.bytesUsed).toBe(twoTilesBudget);
  });

  it('closes all bitmaps on clear()', () => {
    const cache = new TileCache(1024 * 1024);
    const b1 = createMockBitmap(100, 100);
    const b2 = createMockBitmap(100, 100);

    cache.set('t1', b1);
    cache.set('t2', b2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.bytesUsed).toBe(0);
    expect(b1.close).toHaveBeenCalledTimes(1);
    expect(b2.close).toHaveBeenCalledTimes(1);
  });
});
