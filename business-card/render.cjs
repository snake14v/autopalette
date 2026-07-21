// Renders AutoPalette business card front & back to print-res PNGs (1050x600 = 3.5x2in @300dpi)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = __dirname;
  const fileUrl = 'file:///' + path.join(dir, 'card.html').replace(/\\/g, '/');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1400 },
    deviceScaleFactor: 1, // 1 CSS px == 1 device px; card is authored at exact px size
  });
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  // ensure webfonts are done
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  for (const id of ['front', 'back']) {
    const el = await page.$('#' + id);
    const box = await el.boundingBox();
    console.log(id, 'element box:', box.width + 'x' + box.height);
    await el.screenshot({ path: path.join(dir, `autopalette_card_${id}.png`) });
  }

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
