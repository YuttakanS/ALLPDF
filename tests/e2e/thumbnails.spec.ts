import { test, expect } from '@playwright/test';

test.describe('Sub-task 1.3: Virtualized Thumbnail Sidebar', () => {
  test('with a 500-page file, DOM node count for thumbnails stays bounded and click-to-jump works', async ({
    page,
  }) => {
    const startTime = Date.now();

    // Open 500-page synthetic PDF
    await page.goto('/?synthetic=500');

    // 1. Measure main-viewport first page render latency
    const firstPage = page.locator('[data-testid="page-container"][data-page-index="0"]');
    await expect(firstPage).toBeVisible({ timeout: 15000 });
    const latencyWithThumbnails = Date.now() - startTime;

    // Report render latency numbers for docs/LOG.md
    console.log(`[PERF] 500-page first page visible latency: ${latencyWithThumbnails}ms`);
    expect(latencyWithThumbnails).toBeLessThan(4000);

    // 2. Assert thumbnail sidebar is visible
    const sidebar = page.getByTestId('thumbnail-sidebar');
    await expect(sidebar).toBeVisible();

    // 3. Assert thumbnail DOM node count is strictly bounded (<= 15 items even with 500 pages)
    const thumbnailCount = await page.locator('[data-testid="thumbnail-item"]').count();
    console.log(`[PERF] Mounted thumbnail DOM node count with 500 pages: ${thumbnailCount}`);
    expect(thumbnailCount).toBeGreaterThanOrEqual(1);
    expect(thumbnailCount).toBeLessThanOrEqual(15);

    // 4. Assert active-page highlight on page 1
    const thumb1 = page.locator('[data-testid="thumbnail-item"][data-page-index="0"]');
    await expect(thumb1).toBeVisible();
    await expect(thumb1.locator('div').first()).toHaveCSS('border-top-color', 'rgb(26, 115, 232)');

    // 5. Scroll thumbnail sidebar down to page 50 and click to jump
    const thumbnailContainer = page.getByTestId('thumbnail-container');
    await thumbnailContainer.evaluate((el) => {
      el.scrollTop = 49 * 170; // 170px item height
    });

    const thumb50 = page.locator('[data-testid="thumbnail-item"][data-page-index="49"]');
    await expect(thumb50).toBeVisible({ timeout: 5000 });

    // Assert thumbnail DOM count remains bounded after scrolling in sidebar
    const scrolledThumbnailCount = await page.locator('[data-testid="thumbnail-item"]').count();
    expect(scrolledThumbnailCount).toBeLessThanOrEqual(15);

    // Click thumbnail 50
    await thumb50.click();

    // Verify main viewport scrolled to page 50 (index 49)
    const mainPage50 = page.locator('[data-testid="page-container"][data-page-index="49"]');
    await expect(mainPage50).toBeVisible({ timeout: 5000 });

    // Verify page number display in toolbar updated to 50
    const pageInput = page.getByTestId('page-number-input');
    await expect(pageInput).toHaveValue('50');

    // 6. Test sidebar toggle button
    const toggleBtn = page.getByTestId('toggle-sidebar-btn');
    await toggleBtn.click();
    await expect(sidebar).not.toBeVisible();

    await toggleBtn.click();
    await expect(sidebar).toBeVisible();
  });
});
