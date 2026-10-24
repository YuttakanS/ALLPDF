import { test, expect } from '@playwright/test';

test.describe('Sub-task 1.2: Virtualized Tile Renderer & Viewer', () => {
  test('opens a 100-page synthetic PDF, scrolls to end, and asserts virtualization and 60fps responsiveness', async ({
    page,
  }) => {
    // Navigate to viewer with 100-page synthetic PDF
    const startTime = Date.now();
    await page.goto('/?synthetic=100');

    // Instrument PerformanceObserver for Long Tasks (>50ms)
    await page.evaluate(() => {
      (window as unknown as { __longTasks: Array<{ duration: number; startTime: number }> }).__longTasks = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as unknown as { __longTasks: Array<{ duration: number; startTime: number }> }).__longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    });

    // 1. Assert first page is visible
    const firstPage = page.locator('[data-testid="page-container"][data-page-index="0"]');
    await expect(firstPage).toBeVisible({ timeout: 15000 });
    const firstPageVisibleDuration = Date.now() - startTime;
    expect(firstPageVisibleDuration).toBeLessThan(3500);

    // Verify first page canvas rendered
    const firstCanvas = firstPage.locator('canvas');
    await expect(firstCanvas).toBeVisible();

    const viewerContainer = page.getByTestId('viewer-container');
    await expect(viewerContainer).toBeVisible();

    // 2. Assert virtualization: live page containers must stay bounded under a cap (e.g. <= 8 pages out of 100)
    const initialLivePages = await page.locator('[data-testid="page-container"]').count();
    expect(initialLivePages).toBeLessThanOrEqual(8);

    // 3. Perform vertical scrolling down through the 100-page document
    for (let i = 1; i <= 6; i++) {
      await viewerContainer.evaluate((el, step) => {
        el.scrollTop = (el.scrollHeight / 6) * step;
      }, i);
      await page.waitForTimeout(150);

      // Verify DOM node count stays bounded throughout scroll
      const livePageCount = await page.locator('[data-testid="page-container"]').count();
      expect(livePageCount).toBeLessThanOrEqual(8);
    }

    // 4. Scroll to the very bottom and assert last page (page 100, index 99) is rendered
    await viewerContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    const lastPage = page.locator('[data-testid="page-container"][data-page-index="99"]');
    await expect(lastPage).toBeVisible({ timeout: 5000 });

    // Verify first page (index 0) was unmounted from DOM as expected by virtualization
    const firstPageCountAtBottom = await page
      .locator('[data-testid="page-container"][data-page-index="0"]')
      .count();
    expect(firstPageCountAtBottom).toBe(0);

    // 5. Inspect Long Tasks observed during scroll
    const longTasks = await page.evaluate(() => {
      return (window as unknown as { __longTasks: Array<{ duration: number; startTime: number }> }).__longTasks;
    });

    // Report long tasks to console and verify no main-thread stall over 50ms from our code
    const criticalLongTasks = longTasks.filter((t) => t.duration > 50);
    expect(criticalLongTasks.length).toBe(0);

    // 6. Test Zoom controls
    const zoomDisplay = page.getByTestId('zoom-display');
    await expect(zoomDisplay).toHaveText('100%');

    const zoomInBtn = page.getByTestId('zoom-in-btn');
    await zoomInBtn.click();
    await expect(zoomDisplay).toHaveText('115%');

    const fitWidthBtn = page.getByTestId('fit-width-btn');
    await fitWidthBtn.click();
    // Zoom should adjust based on available viewport width
    const fitWidthVal = await zoomDisplay.innerText();
    expect(fitWidthVal).not.toBe('115%');
  });
});
