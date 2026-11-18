const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    console.log("Page loaded!");
    await new Promise(r => setTimeout(r, 2000)); // Wait for 3D render
    await page.screenshot({ path: '/Users/shauryashah/.gemini/antigravity-ide/brain/40298de1-2b41-4efb-b0a0-16c392e01494/artifacts/3d_ui_test.png' });
    console.log("Screenshot saved!");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
  }
})();
