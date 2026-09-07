import { test, expect } from '@playwright/test';

test.describe.skip('MindMap Interactive Manual Editing (Navigation tab removed by design)', () => {
  test('더블 클릭으로 새 노드 생성 및 레이어/그룹 지정 확인', async ({ page }) => {
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

    // Navigate to Mindmap Tab
    const mindmapTab = page.locator('button:has-text("마인드맵")');
    await expect(mindmapTab).toBeVisible({ timeout: 10000 });
    await mindmapTab.click();

    // Verify canvas is visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Double-click on empty canvas area (offset from center to avoid existing nodes)
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await canvas.dblclick({
        position: {
          x: Math.round(box.width / 2 - 150),
          y: Math.round(box.height / 2 - 150),
        }
      });
    }

    // Verify Add Node Modal is displayed
    const modalTitle = page.locator('h3:has-text("새 노드 추가")');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // Fill node label and select options
    await page.fill('input#modalNewNodeName', 'E2E 수기 테스트 노드');
    await page.selectOption('select#modalSelectedLayer', '2'); // 업무/회의
    await page.selectOption('select#modalSelectedGroup', 'OTHER'); // 기타

    // Click submit button
    const submitBtn = page.locator('button:has-text("생성하기")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify modal is closed
    await expect(modalTitle).not.toBeVisible();
  });
});
