const { chromium } = require('@playwright/test');

async function testHydration() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message + '\n' + (err.stack || ''));
  });

  console.log('Navigating to http://localhost:3001/festival/yangjae ...');
  try {
    await page.goto('http://localhost:3001/festival/yangjae', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log('Page Title:', title);

    // Test large font button
    const fontBtn = await page.$('button[title*="글자 크기"]');
    console.log('Font button found:', !!fontBtn);
    if (fontBtn) {
      console.log('Font button initial text:', await fontBtn.innerText());
      await fontBtn.click();
      await page.waitForTimeout(1000);
      console.log('Font button text after 1st click:', await fontBtn.innerText());
      const isLarge = await page.evaluate(() => document.querySelector('.yangjae-dashboard-container')?.classList.contains('is-large-font'));
      console.log('Is large font class active:', isLarge);
    }

    // Test accordion expand all button
    const expandBtn = await page.$('button:has-text("전체 펼치기"), button:has-text("전체 접기")');
    console.log('Accordion button found:', !!expandBtn);
    if (expandBtn) {
      console.log('Accordion initial text:', await expandBtn.innerText());
      await expandBtn.click();
      await page.waitForTimeout(1000);
      console.log('Accordion text after click:', await expandBtn.innerText());
    }

    // Check displayed content for task 1
    const task1Text = await page.evaluate(() => {
      const el = document.querySelector('.yangjae-dashboard-container');
      return el ? el.innerText.substring(0, 1000) : 'no container';
    });
    console.log('Snippet of dashboard content:\n', task1Text.substring(0, 400));

    const hydrationErrors = consoleErrors.filter(e => 
      e.toLowerCase().includes('hydration') || 
      e.toLowerCase().includes('react-dom') ||
      e.toLowerCase().includes('mismatch')
    );

    const hydrationWarnings = consoleWarnings.filter(w => 
      w.toLowerCase().includes('hydration') || 
      w.toLowerCase().includes('mismatch')
    );

    console.log('\n--- RESULTS ---');
    console.log('Total Console Errors:', consoleErrors.length);
    console.log('Total Page Errors:', pageErrors.length);
    console.log('Hydration Errors:', hydrationErrors);
    console.log('Hydration Warnings:', hydrationWarnings);

    if (pageErrors.length > 0) {
      console.log('Page Errors Detail:', pageErrors);
    }

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await browser.close();
  }
}

testHydration();
