import { describe, it, expect } from 'vitest';
import { th } from '../../src/app/i18n/th';
import { en } from '../../src/app/i18n/en';

describe('Sub-task 1.7: i18n and Localization Unit Tests', () => {
  it('has 100% key parity between Thai and English dictionaries', () => {
    const thKeys = Object.keys(th).sort();
    const enKeys = Object.keys(en).sort();

    expect(thKeys).toEqual(enKeys);
    expect(thKeys.length).toBeGreaterThan(25);
  });

  it('contains expected Thai default strings without missing values', () => {
    expect(th['toolbar.toggleSidebar']).toBe('หน้าตัวอย่าง');
    expect(th['toolbar.undo']).toBe('ย้อนกลับ');
    expect(th['toolbar.redo']).toBe('ทำซ้ำ');
    expect(th['toolbar.merge']).toContain('รวมไฟล์');
    expect(th['toolbar.split']).toContain('แบ่งหน้า');
    expect(th['toolbar.export']).toContain('ส่งออก');
  });

  it('contains expected English translations for all keys', () => {
    expect(en['toolbar.toggleSidebar']).toBe('Thumbnails');
    expect(en['toolbar.undo']).toBe('Undo');
    expect(en['toolbar.redo']).toBe('Redo');
    expect(en['toolbar.merge']).toBe('Merge');
    expect(en['toolbar.split']).toBe('Split');
    expect(en['toolbar.export']).toBe('Export');
  });

  it('correctly interpolates parameter placeholders', () => {
    const templateTh = th['sidebar.activeDocs'];
    expect(templateTh).toBe('เอกสารที่เปิดอยู่ ({count})');
    const interpolatedTh = templateTh.replace('{count}', '5');
    expect(interpolatedTh).toBe('เอกสารที่เปิดอยู่ (5)');

    const templateEn = en['split.tabSelected'];
    expect(templateEn).toBe('Selected Pages ({count})');
    const interpolatedEn = templateEn.replace('{count}', '3');
    expect(interpolatedEn).toBe('Selected Pages (3)');
  });
});
