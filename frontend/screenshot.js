const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/Users/shauryashah/.gemini/antigravity-ide/brain/5d620f04-6021-4363-a86a-01188c9561c8/artifacts/current_ui.png' });
  await browser.close();
})();
