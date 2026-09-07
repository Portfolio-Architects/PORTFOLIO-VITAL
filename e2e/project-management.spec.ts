import { test, expect } from '@playwright/test';

test.describe.skip('Project/Business Management Interactive Manual Control (Navigation tab removed by design)', () => {
  test('신규 사업 등록 및 세부 추진 계획 체크리스트 수동 관리 확인', async ({ page }) => {
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
    await page.goto('/');

    // Navigate to Project Management (사업관리) Tab
    const projectTab = page.locator('button:has-text("사업관리")');
    await expect(projectTab).toBeVisible({ timeout: 15000 });
    await projectTab.click();

    // Hydration guard: if sidebar header doesn't show up in 3s, click again
    const sidebarHeader = page.locator('h2:has-text("사업/프로젝트 목록")');
    try {
      await expect(sidebarHeader).toBeVisible({ timeout: 3000 });
    } catch {
      await projectTab.click();
      await expect(sidebarHeader).toBeVisible({ timeout: 10000 });
    }

    // Click the "+" Add Project button
    const addProjectBtn = page.locator('button[title="새 사업 추가"]');
    await expect(addProjectBtn).toBeVisible();
    await addProjectBtn.click();

    // Verify Add Project Modal is open
    const modalTitle = page.locator('h3:has-text("새로운 사업/프로젝트 등록")');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // Fill project information
    await page.fill('input[placeholder="예: 서울체력장 강남센터 구축"]', 'E2E 테스트 서울체력장 사업');
    await page.fill('textarea[placeholder="사업의 주요 목적, 핵심 타임라인 또는 수동 관리 참고 사항을 적어주세요."]', '수동으로 올리는 실무 협의 프로젝트');

    // Click a color theme button inside the modal form
    const colorBtn = page.locator('form button.w-7.h-7').first();
    await expect(colorBtn).toBeVisible();
    await colorBtn.click();

    // Click Submit ("생성") button
    const submitBtn = page.locator('button:has-text("생성")');
    await submitBtn.click();

    // Verify modal is closed
    await expect(modalTitle).not.toBeVisible();

    // Verify the newly created project is selected and header title matches
    const projectHeaderTitle = page.locator('h1:has-text("E2E 테스트 서울체력장 사업")');
    await expect(projectHeaderTitle).toBeVisible({ timeout: 5000 });

    // Add a checklist item to the project
    await page.fill('input[placeholder="새로운 세부 항목 추가..."]', '1단계 시범 사업 기획안 수립');
    const addChecklistBtn = page.locator('button[type="submit"]:has-text("추가")');
    await addChecklistBtn.click();

    // Verify the checklist item is added to the list
    const checklistItem = page.locator('span:has-text("1단계 시범 사업 기획안 수립")');
    await expect(checklistItem).toBeVisible({ timeout: 5000 });

    // Click the checklist item to toggle it as completed
    await checklistItem.click();

    // Verify it is completed (indicated by line-through or green check icon)
    const completedChecklistItem = page.locator('span.line-through:has-text("1단계 시범 사업 기획안 수립")');
    await expect(completedChecklistItem).toBeVisible({ timeout: 5000 });
  });
});
