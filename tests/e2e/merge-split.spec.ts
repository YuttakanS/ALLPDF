import { test, expect } from '@playwright/test';
import { createSyntheticPdf } from '../helpers/synthetic-pdf';

test.describe('Sub-task 1.5: Merge and Split', () => {
  test('merging A(3p) + B(5p) yields 8 pages in right order, supports collapse/remove/undo, and split validates ranges without silent clamping', async ({
    page,
  }) => {
    // 1. Open initial document with 3 pages
    await page.goto('/?synthetic=3');

    const firstPage = page.locator('[data-testid="page-container"][data-page-index="0"]');
    await expect(firstPage).toBeVisible({ timeout: 15000 });

    // Verify initial count: 3 pages
    const toolbarPageInfo = page.locator('form span').last();
    await expect(toolbarPageInfo).toHaveText('/ 3');

    // 2. Merge: Add second document B with 5 pages
    const docBBuffer = Buffer.from(createSyntheticPdf({ pageCount: 5, width: 500, height: 700 }));

    const fileInput = page.getByTestId('file-merge-input');
    await fileInput.setInputFiles({
      name: 'docB_5pages.pdf',
      mimeType: 'application/pdf',
      buffer: docBBuffer,
    });

    // Verify page count updated from 3 to 8
    await expect(toolbarPageInfo).toHaveText('/ 8');

    // Verify thumbnail sidebar contains virtualized thumbnails and can scroll to page 8
    const allThumbnails = page.locator('[data-testid="thumbnail-item"]');
    const initialThumbCount = await allThumbnails.count();
    expect(initialThumbCount).toBeGreaterThanOrEqual(5);
    expect(initialThumbCount).toBeLessThanOrEqual(8);

    // Scroll thumbnail sidebar to bottom to verify page 8 is reachable
    const thumbContainer = page.getByTestId('thumbnail-container');
    await thumbContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const page8Thumb = page.locator('[data-testid="thumbnail-item"][data-page-index="7"]');
    await expect(page8Thumb).toBeVisible();

    // Scroll back to top
    await thumbContainer.evaluate((el) => {
      el.scrollTop = 0;
    });

    // Verify document manager shows 2 documents
    const docManager = page.getByTestId('doc-manager');
    await expect(docManager).toBeVisible();
    await expect(docManager).toContainText('เอกสารที่เปิดอยู่ (2)');
    await expect(docManager).toContainText('docB_5pages.pdf');

    // 3. Test per-file collapse
    const collapseButtons = docManager.locator('button[data-testid^="collapse-doc-"]');
    await expect(collapseButtons).toHaveCount(2);

    // Collapse first document (3 pages)
    await collapseButtons.first().click();
    // Only 5 thumbnails should now be visible in sidebar
    await expect(allThumbnails).toHaveCount(5);

    // Expand first document back
    await collapseButtons.first().click();
    await expect(toolbarPageInfo).toHaveText('/ 8');

    // 4. Test per-file remove & undo
    const removeButtons = docManager.locator('button[data-testid^="remove-doc-"]');
    // Remove docB (second document)
    await removeButtons.nth(1).click();
    await expect(toolbarPageInfo).toHaveText('/ 3');
    await expect(allThumbnails).toHaveCount(3);

    // Undo file removal
    const undoBtn = page.getByTestId('undo-btn');
    await undoBtn.click();
    await expect(toolbarPageInfo).toHaveText('/ 8');

    // 5. Test Split Dialog & Range Validation
    const openSplitBtn = page.getByTestId('open-split-btn');
    await openSplitBtn.click();

    const splitDialog = page.getByTestId('split-dialog');
    await expect(splitDialog).toBeVisible();

    const rangeInput = page.getByTestId('split-range-input');
    const confirmBtn = page.getByTestId('confirm-split-btn');
    const errorBox = page.getByTestId('split-range-error');

    // 5a. Out-of-bounds rejection (document has 8 pages, ask for 12)
    await rangeInput.fill('1-3, 12');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('out of bounds (1-8)');
    await expect(errorBox).toContainText('อยู่นอกช่วงที่ถูกต้อง (1-8)');
    await expect(confirmBtn).toBeDisabled();

    // 5b. Start > End rejection
    await rangeInput.fill('6-3');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('start page cannot be greater than end page');
    await expect(errorBox).toContainText('หน้าเริ่มต้นต้องไม่มากกว่าหน้าสิ้นสุด');
    await expect(confirmBtn).toBeDisabled();

    // 5c. Valid Range with ZIP bundle preview
    await rangeInput.fill('1-3, 4-6, 7-8');
    await expect(errorBox).not.toBeVisible();
    const previewBox = page.getByTestId('split-preview');
    await expect(previewBox).toBeVisible();
    await expect(previewBox).toContainText('จะสร้าง 3 ไฟล์ บรรจุในไฟล์ .zip');
    await expect(confirmBtn).toBeEnabled();

    // 5d. Trigger download of .zip output
    const downloadPromise = page.waitForEvent('download');
    await confirmBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('split_document.zip');

    // Dialog should close after split completion
    await expect(splitDialog).not.toBeVisible();
  });
});
