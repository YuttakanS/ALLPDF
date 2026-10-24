import { describe, it, expect } from 'vitest';

describe('Thai Word Segmentation Smoke Test', () => {
  it('segments a Thai sentence into multiple words using Intl.Segmenter', () => {
    const text = 'สวัสดีชาวโลก';
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    const segments = Array.from(segmenter.segment(text)).map((s) => s.segment);

    expect(segments.length).toBeGreaterThan(1);
    expect(segments).toContain('สวัสดี');
    expect(segments.join('')).toBe(text);
  });
});
