import { chromium, webkit, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mockStatsLive } from '../tests/browser/fixtures/stats-live';

const output = resolve('artifacts/stats-live', process.argv[2] || 'final');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8787';
await mkdir(output, { recursive: true });
const measurements: unknown[] = [];
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
  const geometry = await page.evaluate(() => {
    const button = document.querySelector('.stats-live-control button');
    const box = button?.getBoundingClientRect();
    return { innerHeight, clientHeight: document.documentElement.clientHeight, visualHeight: visualViewport?.height, width: innerWidth, documentWidth: document.documentElement.scrollWidth, button: box ? { top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null };
  });
  measurements.push({ name, ...geometry });
  console.log(`${name}: viewport ${geometry.innerHeight}, end button bottom ${geometry.button?.bottom ?? 'none'}`);
}
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  const sizes = engine === chromium ? [[360, 800], [375, 812], [390, 844], [430, 932], [390, 640], [768, 1024], [1024, 900], [1440, 1080]] : [[390, 844]];
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768, serviceWorkers: 'block' });
    const page = await context.newPage();
    const mock = await mockStatsLive(page);
    await page.goto(`${base}${mock.path}`);
    await expect(page.getByRole('button', { name: 'Baigti pokalbį', exact: true })).toBeVisible();
    const name = `${engine.name()}-${width}x${height}`;
    await capture(page, `active-${name}`);
    mock.setOutcome('closing');
    await page.getByRole('button', { name: 'Baigti pokalbį', exact: true }).click();
    await expect(page.getByText('Uždarymas dar nepatvirtintas', { exact: true })).toBeVisible();
    await capture(page, `closing-${name}`);
    mock.setOutcome('ended');
    await page.getByRole('button', { name: 'Bandyti užbaigti dabar', exact: true }).click();
    await expect(page.getByText('Pokalbis baigtas', { exact: true })).toBeVisible();
    await capture(page, `ended-${name}`);
    await context.close();
  }
  await browser.close();
}
await writeFile(`${output}/geometry.json`, JSON.stringify(measurements, null, 2));
