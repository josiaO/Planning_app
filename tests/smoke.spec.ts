import { test, expect } from '@playwright/test';

test('app root loads and has Vision heading', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page.locator('text=Vision')).toBeVisible();
});
