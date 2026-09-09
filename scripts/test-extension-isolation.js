const { chromium } = require('playwright');

async function testExtensionCollision() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Inject crx-mouse-redesign-content-root before SplashView
  await page.addInitScript(() => {
    const checkAndInject = () => {
      if (document.body && !document.getElementById('crx-mouse-redesign-content-root')) {
        const div = document.createElement('div');
        div.id = 'crx-mouse-redesign-content-root';
        div.style.cssText = 'position:fixed;top:0px;left:0px;width:0px;height:0px;overflow-x:visible;overflow-y:visible;';
        if (document.body.children.length > 0) {
          document.body.insertBefore(div, document.body.children[document.body.children.length - 1]);
        } else {
          document.body.appendChild(div);
        }
      }
    };
    document.addEventListener('readystatechange', checkAndInject);
    const obs = new MutationObserver(checkAndInject);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });

  const errors = [];
  page.on('console', msg => {
    const text = String(msg.text() || '');
    if (msg.type() === 'error' || text.includes('mismatch') || text.includes('hydration')) {
      errors.push(text);
    }
  });

  await page.goto('http://localhost:3001', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const overlay = await page.evaluate(() => {
    return {
      hasOverlay: !!document.querySelector('[data-nextjs-dialog-overlay]'),
      crxInBody: !!document.querySelector('body > #crx-mouse-redesign-content-root'),
      crxInHtml: !!document.querySelector('html > #crx-mouse-redesign-content-root'),
    };
  });

  console.log('Overlay Status:', overlay);
  console.log('Errors logged:', errors);

  await browser.close();
}

testExtensionCollision();
