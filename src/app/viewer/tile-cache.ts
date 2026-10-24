export interface TileCacheEntry {
  key: string;
  bitmap: ImageBitmap;
  byteSize: number;
}

export class TileCache {
  private readonly maxBytes: number;
  private currentBytes = 0;
  private entries = new Map<string, TileCacheEntry>();

  constructor(maxBytes = 128 * 1024 * 1024) {
    this.maxBytes = maxBytes;
  }

  get bytesUsed(): number {
    return this.currentBytes;
  }

  get maxByteCapacity(): number {
    return this.maxBytes;
  }

  get size(): number {
    return this.entries.size;
  }

  static computeByteSize(bitmap: ImageBitmap): number {
    // 4 bytes per pixel (RGBA32)
    return bitmap.width * bitmap.height * 4;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get(key: string): ImageBitmap | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    // Refresh LRU order (delete and re-insert)
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.bitmap;
  }

  set(key: string, bitmap: ImageBitmap): void {
    const existing = this.entries.get(key);
    if (existing) {
      this.currentBytes -= existing.byteSize;
      existing.bitmap.close();
      this.entries.delete(key);
    }

    const byteSize = TileCache.computeByteSize(bitmap);

    // If a single tile exceeds the entire cache capacity, do not cache
    if (byteSize > this.maxBytes) {
      bitmap.close();
      return;
    }

    // Evict least-recently used entries until under byte capacity
    while (this.currentBytes + byteSize > this.maxBytes && this.entries.size > 0) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) break;
      this.evict(oldestKey);
    }

    this.entries.set(key, { key, bitmap, byteSize });
    this.currentBytes += byteSize;
  }

  private evict(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;

    this.currentBytes -= entry.byteSize;
    entry.bitmap.close();
    this.entries.delete(key);
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    this.currentBytes -= entry.byteSize;
    entry.bitmap.close();
    return this.entries.delete(key);
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      entry.bitmap.close();
    }
    this.entries.clear();
    this.currentBytes = 0;
  }
}
