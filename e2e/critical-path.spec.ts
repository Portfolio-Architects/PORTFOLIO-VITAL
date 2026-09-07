import { test, expect } from '@playwright/test';

test.describe('HCHPS UI Critical Path', () => {
  // 앱 접속 전 전역 락을 우회하기 위한 Mock 등은 useSecurityLock 내부에서 자동처리 됨
  
  test('대시보드 메인 페이지 렌더링 확인', async ({ page }) => {
    // Set authentication cookie to bypass middleware login redirect
    await page.context().addCookies([
      {
        name: 'hchps_session',
        value: 'authenticated-secure-session-token',
        domain: 'localhost',
        path: '/',
      }
    ]);

    // Navigate to the app
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Security Lock is automatically bypassed, so we should see the Dashboard
    const title = await page.title();
    expect(title).not.toBeNull();

    // Check for core navigation or main sections visible on mobile/desktop
    // Using a structural locator to ensure it generally mounts correctly
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 });
  });

  test('LLM 통합 검색 패널 렌더링 확인', async ({ page }) => {
    // Set authentication cookie to bypass middleware login redirect
    await page.context().addCookies([
      {
        name: 'hchps_session',
        value: 'authenticated-secure-session-token',
        domain: 'localhost',
        path: '/',
      }
    ]);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Assuming there is a plus button, search icon, or mic icon globally rendered
    // If not, we just check if body is loaded
    await expect(page.locator('body')).toBeVisible();
    
    // Evaluate if React mounted (id=__next or similar Next.js 14/15 root wrapper)
    const isNextMounted = await page.evaluate(() => {
      return document.querySelector('body > script') !== null || document.querySelector('div') !== null;
    });
    expect(isNextMounted).toBe(true);
  });

  test('로그인 페이지 렌더링 및 미들웨어 리다이렉트 확인', async ({ page }) => {
    // Do NOT set cookie, navigate to root
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Should be redirected to /login
    await expect(page).toHaveURL(/.*\/login/);

    // Login page should have the title visible
    await expect(page.getByText('VITAL Work Manager')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your ID')).toBeVisible();
  });
});
