import { test, expect } from '@playwright/test';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

test.describe('Sub-task 1.6: Export / Save and Round-trip Verification', () => {
  test('exports modified document with Thai filename, verifies download, and round-trips via pdf.js', async ({
    page,
  }) => {
    // Delete showSaveFilePicker so it exercises the standard Blob + <a> download fallback
    await page.addInitScript(() => {
      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });

    // Open a 4-page synthetic PDF
    await page.goto('/?synthetic=4');

    const firstPage = page.locator('[data-testid="page-container"][data-page-index="0"]');
    await expect(firstPage).toBeVisible({ timeout: 15000 });

    const toolbarPageInfo = page.locator('form span').last();
    await expect(toolbarPageInfo).toHaveText('/ 4');

    // Rotate page 1 by 90° CW
    const rotateCwBtn = page.getByTestId('rotate-cw-btn');
    await rotateCwBtn.click();
    await expect(firstPage).toHaveAttribute('data-rotation', '90');

    // Delete page 4 -> 3 pages remaining
    const allThumbnails = page.locator('[data-testid="thumbnail-item"]');
    await allThumbnails.nth(3).click();
    const deleteBtn = page.getByTestId('delete-page-btn');
    await deleteBtn.click();
    await expect(toolbarPageInfo).toHaveText('/ 3');

    // Click Export PDF button and intercept download
    const exportBtn = page.getByTestId('export-pdf-btn');
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();

    const download = await downloadPromise;
    // Verify Thai filename survives and is NFC normalized
    const filename = download.suggestedFilename();
    expect(filename).toBe('เอกสาร_ส่งออก.pdf');
    expect(filename).toBe(filename.normalize('NFC'));

    // Read exported file stream into buffer
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    if (!stream) return;

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const downloadedBuffer = Buffer.concat(chunks);
    expect(downloadedBuffer.byteLength).toBeGreaterThan(0);

    // Round-trip verification via pdf.js in the test environment
    const pdfjsDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(downloadedBuffer),
    }).promise;

    // Verify 3 pages in exported PDF
    expect(pdfjsDoc.numPages).toBe(3);

    // Verify page 1 has 90° rotation preserved
    const page1 = await pdfjsDoc.getPage(1);
    expect(page1.rotate).toBe(90);

    // Cleanup pdf.js document
    await pdfjsDoc.cleanup();
  });

  test('uses File System Access API showSaveFilePicker when available', async ({ page }) => {
    // Open a 2-page synthetic PDF
    await page.goto('/?synthetic=2');

    // Mock showSaveFilePicker on the page
    await page.evaluate(() => {
      (window as unknown as { __savedFilename?: string; __savedBytesLength?: number }).__savedFilename = '';
      (window as unknown as { __savedBytesLength?: number }).__savedBytesLength = 0;

      (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async (options: {
        suggestedName: string;
      }) => {
        (window as unknown as { __savedFilename: string }).__savedFilename = options.suggestedName;
        return {
          createWritable: async () => ({
            write: async (data: Uint8Array) => {
              (window as unknown as { __savedBytesLength: number }).__savedBytesLength = data.byteLength;
            },
            close: async () => {},
          }),
        };
      };
    });

    const exportBtn = page.getByTestId('export-pdf-btn');
    await exportBtn.click();

    // Verify that showSaveFilePicker was invoked with normalized Thai name
    await expect.poll(async () => {
      return page.evaluate(() => (window as unknown as { __savedFilename?: string }).__savedFilename);
    }).toBe('เอกสาร_ส่งออก.pdf');

    // Verify bytes were written through the stream
    const bytesLength = await page.evaluate(() => (window as unknown as { __savedBytesLength?: number }).__savedBytesLength);
    expect(bytesLength).toBeGreaterThan(0);
  });
});
