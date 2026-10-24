import { test, expect } from '@playwright/test';

test.describe('Sub-task 1.4: Page Model & Operations', () => {
  test('rotate, delete, reorder, and undo/redo in both main view and thumbnails', async ({
    page,
  }) => {
    // Open a 10-page synthetic PDF
    await page.goto('/?synthetic=10');

    // Wait for first page to be visible
    const firstPage = page.locator('[data-testid="page-container"][data-page-index="0"]');
    await expect(firstPage).toBeVisible({ timeout: 15000 });

    // Verify initial state: 10 pages displayed in toolbar
    const toolbarPageInfo = page.locator('form span').last();
    await expect(toolbarPageInfo).toHaveText('/ 10');

    // 1. Rotate Page Operations
    // Initially rotation is 0
    await expect(firstPage).toHaveAttribute('data-rotation', '0');

    // Rotate 90° CW
    const rotateCwBtn = page.getByTestId('rotate-cw-btn');
    await rotateCwBtn.click();
    await expect(firstPage).toHaveAttribute('data-rotation', '90');

    // Rotate 180° -> 90 + 180 = 270
    const rotate180Btn = page.getByTestId('rotate-180-btn');
    await rotate180Btn.click();
    await expect(firstPage).toHaveAttribute('data-rotation', '270');

    // Rotate 90° CCW -> 270 - 90 = 180
    const rotateCcwBtn = page.getByTestId('rotate-ccw-btn');
    await rotateCcwBtn.click();
    await expect(firstPage).toHaveAttribute('data-rotation', '180');

    // Undo rotation steps
    const undoBtn = page.getByTestId('undo-btn');
    const redoBtn = page.getByTestId('redo-btn');

    // Undo CCW -> back to 270
    await undoBtn.click();
    await expect(firstPage).toHaveAttribute('data-rotation', '270');

    // Undo 180 -> back to 90
    await undoBtn.click();
    await expect(firstPage).toHaveAttribute('data-rotation', '90');

    // Undo CW -> back to 0
    await undoBtn.click();
    await expect(firstPage).toHaveAttribute('data-rotation', '0');

    // Redo -> back to 90
    await redoBtn.click();
    await expect(firstPage).toHaveAttribute('data-rotation', '90');

    // Reset back to 0 via undo
    await undoBtn.click();
    await expect(firstPage).toHaveAttribute('data-rotation', '0');

    // 2. Delete Page Operation
    const deleteBtn = page.getByTestId('delete-page-btn');
    await deleteBtn.click();

    // Active pages should now be 9
    await expect(toolbarPageInfo).toHaveText('/ 9');
    // Page index 0 should no longer be present in page containers
    await expect(page.locator('[data-testid="page-container"][data-page-index="0"]')).toHaveCount(0);
    // First visible page is now sourcePageIndex 1
    const newFirstPage = page.locator('[data-testid="page-container"][data-page-index="1"]');
    await expect(newFirstPage).toBeVisible();

    // Undo Delete
    await undoBtn.click();
    await expect(toolbarPageInfo).toHaveText('/ 10');
    await expect(firstPage).toBeVisible();

    // Redo Delete
    await redoBtn.click();
    await expect(toolbarPageInfo).toHaveText('/ 9');

    // Undo Delete again to keep 10 pages for reorder tests
    await undoBtn.click();
    await expect(toolbarPageInfo).toHaveText('/ 10');

    // 3. Move Page (Reorder) via Move Down / Move Up
    // Select thumbnail for page 1
    const thumb0 = page.locator('[data-testid="thumbnail-item"]').first();
    await thumb0.click();

    // Click Move Down -> page 0 moves after page 1
    const moveDownBtn = page.getByTestId('move-down-btn');
    await moveDownBtn.click();

    // In thumbnails, the first thumbnail item should now show "หน้า 2" (sourcePageIndex 1)
    const firstThumbText = page.locator('[data-testid="thumbnail-item"] span').first();
    await expect(firstThumbText).toHaveText('หน้า 1'); // display label is 1-based index in list
    // The data-page-index of the first thumbnail's entry should now be 1
    // And the second thumbnail's entry should be 0
    const allThumbnails = page.locator('[data-testid="thumbnail-item"]');
    await expect(allThumbnails.nth(1)).toHaveAttribute('data-page-id', await firstPage.getAttribute('data-page-id') || '');

    // Move Up -> moves back to index 0
    const moveUpBtn = page.getByTestId('move-up-btn');
    await moveUpBtn.click();
    await expect(allThumbnails.first()).toHaveAttribute('data-page-id', await firstPage.getAttribute('data-page-id') || '');

    // 4. Drag and Drop Reorder
    const sourceThumb = allThumbnails.first();
    const targetThumb = allThumbnails.nth(2); // Page 3 (display index 2)

    await sourceThumb.dragTo(targetThumb);

    // After dropping before page 3, order should be page 1, page 0, page 2
    // Undo drag reorder
    await undoBtn.click();
    await expect(allThumbnails.first()).toHaveAttribute('data-page-id', await firstPage.getAttribute('data-page-id') || '');

    // 5. Multi-selection Delete
    // Click page 1
    await allThumbnails.nth(0).click();
    // Shift-click page 3 (selects pages 1, 2, 3)
    await allThumbnails.nth(2).click({ modifiers: ['Shift'] });

    // Delete 3 pages
    await deleteBtn.click();
    await expect(toolbarPageInfo).toHaveText('/ 7');

    // Undo multi-delete
    await undoBtn.click();
    await expect(toolbarPageInfo).toHaveText('/ 10');
  });
});
