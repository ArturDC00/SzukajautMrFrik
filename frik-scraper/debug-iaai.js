const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-gpu'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'en-US',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });
  const page = await context.newPage();
  await page.goto('https://www.iaai.com/VehicleDetail/45171480~US', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);
  const title = await page.title();
  const url = page.url();
  const snippet = await page.evaluate(() => document.body.innerText.slice(0, 1200));
  const h1s = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2')).map(e=>e.textContent.trim()).slice(0,5));
  const hasVin = await page.evaluate(() => /[A-HJ-NPR-Z0-9]{17}/.test(document.body.innerText));
  console.log('TITLE:', title);
  console.log('URL:', url);
  console.log('HAS_VIN:', hasVin);
  console.log('H1/H2:', JSON.stringify(h1s));
  console.log('SNIPPET:', snippet);
  await browser.close();
})().catch(e => console.error('ERR:', e.message));
