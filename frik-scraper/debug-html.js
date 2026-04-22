const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://www.iaai.com/VehicleDetail/45171480~US', { waitUntil: 'networkidle', timeout: 35000 });
  const html = await page.content();
  // Print first 3000 chars
  console.log(html.slice(0, 3000));
  await browser.close();
})().catch(e => console.error(e.message));
