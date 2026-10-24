import { test, expect } from '@playwright/test';

test.describe('App Shell and Security Smoke Test', () => {
  test('loads the app and confirms crossOriginIsolated is true', async ({ page }) => {
    await page.goto('/');

    // Verify main header renders
    const heading = page.getByRole('heading', { name: /ALLPDF - Thai-first PDF Web Toolkit/i });
    await expect(heading).toBeVisible();

    // Verify crossOriginIsolated on window
    const isIsolated = await page.evaluate(() => window.crossOriginIsolated);
    expect(isIsolated).toBe(true);

    // Verify isolation status rendered in the DOM
    const statusText = page.getByTestId('cross-origin-isolated-status');
    await expect(statusText).toHaveText('true');
  });
});
