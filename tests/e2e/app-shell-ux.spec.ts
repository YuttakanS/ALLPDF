import { test, expect } from '@playwright/test';

test.describe('Sub-task 1.7: App Shell, Localization, Help & Responsive Mobile UX', () => {
  test('switches language, verifies help dialog shortcuts, tests toast notifications, and validates mobile viewport', async ({
    page,
  }) => {
    // 1. Open app with a 3-page synthetic PDF
    await page.goto('/?synthetic=3');

    const firstPage = page.locator('[data-testid="page-container"][data-page-index="0"]');
    await expect(firstPage).toBeVisible({ timeout: 15000 });

    const toggleSidebarBtn = page.getByTestId('toggle-sidebar-btn');
    const undoBtn = page.getByTestId('undo-btn');
    const redoBtn = page.getByTestId('redo-btn');
    const langBtn = page.getByTestId('language-toggle-btn');
    const helpBtn = page.getByTestId('help-btn');

    // 2. Language: Thai by default
    await expect(toggleSidebarBtn).toContainText('หน้าตัวอย่าง');
    await expect(undoBtn).toContainText('ย้อนกลับ');
    await expect(redoBtn).toContainText('ทำซ้ำ');
    await expect(langBtn).toContainText('TH');

    // Switch to English
    await langBtn.click();
    await expect(toggleSidebarBtn).toContainText('Thumbnails');
    await expect(undoBtn).toContainText('Undo');
    await expect(redoBtn).toContainText('Redo');
    await expect(langBtn).toContainText('EN');

    // Switch back to Thai
    await langBtn.click();
    await expect(toggleSidebarBtn).toContainText('หน้าตัวอย่าง');
    await expect(undoBtn).toContainText('ย้อนกลับ');

    // 3. Help Dialog & Shortcuts
    await helpBtn.click();
    const helpDialog = page.getByTestId('help-dialog');
    await expect(helpDialog).toBeVisible();

    // Verify key shortcut listings exist in help table
    await expect(helpDialog).toContainText('Ctrl + Z');
    await expect(helpDialog).toContainText('Ctrl + Y');
    await expect(helpDialog).toContainText('+ / =');
    await expect(helpDialog).toContainText('Delete / Backspace');

    // Close help dialog via close button
    const closeHelpBtn = page.getByTestId('close-help-btn');
    await closeHelpBtn.click();
    await expect(helpDialog).not.toBeVisible();

    // Verify pressing '?' opens help dialog
    await page.keyboard.press('?');
    await expect(helpDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(helpDialog).not.toBeVisible();

    // 4. Toast Notifications
    const rotateCwBtn = page.getByTestId('rotate-cw-btn');
    await rotateCwBtn.click();

    const toastMessage = page.getByTestId('toast-message');
    await expect(toastMessage).toBeVisible();
    await expect(toastMessage).toContainText('หมุนหน้าเอกสารสำเร็จ');

    // 5. Mobile Viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });

    // Desktop sidebar should be collapsed/hidden on mobile
    const desktopSidebar = page.locator('aside[data-testid="thumbnail-sidebar"]');
    await expect(desktopSidebar).not.toBeVisible();

    // Main viewer container remains fully visible and responsive
    const viewerContainer = page.getByTestId('viewer-container');
    await expect(viewerContainer).toBeVisible();

    // Click toggle sidebar button on mobile -> opens mobile bottom sheet
    await toggleSidebarBtn.click();
    const mobileSheet = page.getByTestId('mobile-bottom-sheet');
    await expect(mobileSheet).toBeVisible();

    // Verify thumbnails exist inside mobile bottom sheet
    const mobileThumbnails = mobileSheet.locator('[data-testid="thumbnail-item"]');
    await expect(mobileThumbnails.first()).toBeVisible();

    // Close mobile bottom sheet
    const closeMobileSheetBtn = page.getByTestId('close-mobile-sheet-btn');
    await closeMobileSheetBtn.click();
    await expect(mobileSheet).not.toBeVisible();
  });
});
