import { test, expect } from '@playwright/test';

test('has application title', async ({ page }) => {
  // Go to the local dev server
  await page.goto('/');
  // Next.js metadata title renders "WORK VITAL"
  const title = await page.title();
  expect(title).toMatch(/WORK VITAL/i);
});
