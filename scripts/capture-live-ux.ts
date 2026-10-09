import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { mockLive } from '../tests/browser/fixtures/live';

const output = 'artifacts/live-ux-2026-09-16';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await context.newPage();
await page.addInitScript('window.__name = value => value;');
await mockLive(page, { meter: true });
await page.route('**/api/chat', route => route.fulfill({ json: { text: 'Staliukas šešiems rytoj 15:30.', sources: [], agreement: { fields: [
  { label: 'Data', value: 'Rytoj; tiksli data nepasakyta.', status: 'unclear', evidence: [{ id: 'in', quote: 'rytoj' }] },
  { label: 'Laikas', value: '15:30', status: 'heard', evidence: [{ id: 'in', quote: 'penkioliktą trisdešimt' }] },
  { label: 'Žmonių skaičius', value: 'Šeši žmonės', status: 'heard', evidence: [{ id: 'in', quote: 'šešiems' }] },
  ...['Vieta', 'Kaina', 'Kitos sąlygos'].map(label => ({ label, value: 'Nepaminėta', status: 'missing', evidence: [] })),
], questions: ['Ar staliukas jau rezervuotas?'] } } }));
const geometry: unknown[] = [];
const capture = async (name: string) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/${name}.png` });
  geometry.push({ name, ...await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, scrollWidth: document.documentElement.scrollWidth, controls: [...document.querySelectorAll('.live-controls button')].map(button => { const r = button.getBoundingClientRect(); return { text: button.textContent, top: r.top, bottom: r.bottom, height: r.height }; }) })) });
};
const say = async (id: string, role: string, text: string, at: number) => page.evaluate(({ id, role, text, at }) => (window as any).fakePeer.channel.emit({ type: `session.${role}_transcript.delta`, event_id: id, delta: text, start_ms: at, end_ms: at + 700 }), { id, role, text, at });
try {
  await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:4181');
  await page.getByRole('button', { name: 'Versti pokalbį', exact: true }).waitFor();
  await capture('home-390x640');
  await page.getByRole('button', { name: 'Versti pokalbį', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Galite kalbėti', exact: true })).toBeVisible();
  await say('in', 'input', 'Norėtume staliuko šešiems rytoj penkioliktą trisdešimt.', 0);
  await say('out', 'output', 'Θα θέλαμε ένα τραπέζι για έξι άτομα αύριο στις δεκαπέντε και τριάντα.', 200);
  await capture('live-390x640');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Pasirinkti vertimą:/ }).click();
  await capture('selected-390x844');
  await page.getByRole('button', { name: 'Parodyti žmogui', exact: true }).click();
  await expect(page.getByText('Klausomės atsakymo · Può rispondere')).toBeVisible();
  await capture('show-and-listen-390x844');
  await page.getByRole('button', { name: 'Grįžti', exact: true }).click();
  await page.getByRole('button', { name: 'Daugiau veiksmų', exact: true }).click();
  await page.getByRole('button', { name: 'Ką sutarėme?', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('15:30');
  await capture('recap-390x844');
  await page.getByRole('button', { name: 'Grįžti į pokalbį', exact: true }).click();
  await page.getByRole('button', { name: 'Rodyti naujausią', exact: true }).click();
  await page.getByRole('button', { name: 'Baigti pokalbį', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 640 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture('ended-390x640');
  await writeFile(`${output}/geometry.json`, JSON.stringify(geometry, null, 2));
} finally { await context.close(); await browser.close(); }
