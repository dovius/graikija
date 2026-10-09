import { chromium, webkit, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { mockLive } from '../tests/browser/fixtures/live';

const output = process.env.QA_OUTPUT || 'data/analysis/mobile-ux-2026-09-16';
const engine = process.env.QA_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ executablePath: engine === chromium ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE : undefined });
await mkdir(output, { recursive: true });
const measurements: unknown[] = [];
const say = async (page: Page, id: string, role: string, text: string, at: number) => page.evaluate(({ id, role, text, at }) => (window as any).fakePeer.channel.emit({ type: `session.${role}_transcript.delta`, event_id: id, delta: text, start_ms: at, end_ms: at + 700 }), { id, role, text, at });

try {
  for (const [width, height] of [[390, 640], [320, 568], [430, 932], [1440, 1000]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 740, hasTouch: width < 740, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.addInitScript('window.__name = value => value;');
    await mockLive(page, { meter: true });
    await page.route('**/api/chat', route => {
      const body = route.request().postDataJSON();
      return route.fulfill({ json: body.purpose === 'recap' ? {
        text: 'Staliukas šešiems rytoj 15:30.', sources: [], agreement: { fields: [
          { label: 'Data', value: 'Rytoj; tiksli data nepasakyta.', status: 'unclear', evidence: [{ id: 'in', quote: 'rytoj' }] },
          { label: 'Laikas', value: '15:30', status: 'heard', evidence: [{ id: 'in', quote: 'penkioliktą trisdešimt' }] },
          { label: 'Žmonių skaičius', value: 'Šeši žmonės', status: 'heard', evidence: [{ id: 'in', quote: 'šešiems' }] },
          ...['Vieta', 'Kaina', 'Kitos sąlygos'].map(label => ({ label, value: 'Nepaminėta', status: 'missing', evidence: [] })),
        ], questions: ['Ar staliukas jau rezervuotas?'] },
      } : { text: body.mode === 'photo' ? 'Tai restorano meniu.\n\n**Musaka – 12 €.** Padaže yra bazilikų, sūrio ir riešutų.\n\n**Vanduo – 3 €.** Aptarnavimo mokestis – 2,50 € žmogui.\n\nJei turite alergijų, pasitikslinkite su padavėju.' : 'Sąskaitos galite paprašyti taip:\n\n**Τον λογαριασμό, παρακαλώ.**\n\nLietuviškai: „Sąskaitą, prašau.“\n\nJeigu norite mokėti kortele, pridėkite: **Μπορώ να πληρώσω με κάρτα;**', sources: [] } });
    });
    const capture = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      const size = page.viewportSize()!;
      await page.screenshot({ path: `${output}/${name}-${size.width}x${size.height}.png` });
      measurements.push({ name, ...size, ...await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
        modal: [...document.querySelectorAll('dialog[open], dialog[open] .modal-heading, dialog[open] .modal-close, dialog[open] .modal-content')].map(el => { const r = el.getBoundingClientRect(); return { className: el.className, top: r.top, bottom: r.bottom, left: r.left, right: r.right, scrollTop: el.scrollTop }; }),
        controls: [...document.querySelectorAll('.live-stage button, .live-controls button, .composer-actions button, .action-card, .modal-footer button')].filter(el => el.getBoundingClientRect().height > 0).map(el => {
          const rect = el.getBoundingClientRect(); return { text: el.textContent, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        }),
      })) });
    };
    await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:4181');
    await page.getByRole('button', { name: 'Versti pokalbį', exact: true }).waitFor();
    await capture('home');
    if (width > 740) { await context.close(); continue; }
    await page.getByRole('button', { name: 'Kaip naudotis?', exact: true }).click();
    await capture('help');
    await page.getByRole('button', { name: 'Supratau', exact: true }).click();
    await page.getByRole('button', { name: 'Išversti nuotrauką', exact: true }).click();
    await capture('photo');
    await page.getByLabel('Pasirinkti nuotraukos failą').setInputFiles('tests/fixtures/menu.svg');
    await expect(page.locator('.message.assistant')).toBeVisible();
    await capture('photo-answer');
    await page.getByRole('button', { name: 'Į pradžią', exact: true }).click();
    await page.getByRole('button', { name: 'Paklausti patarimo', exact: true }).click();
    await capture('assistant');
    await page.getByRole('button', { name: 'Kaip paprašyti sąskaitos?', exact: true }).click();
    await expect(page.locator('.message.assistant')).toBeVisible();
    await capture('assistant-answer');
    if (width === 390) {
      await page.setViewportSize({ width, height: 380 });
      await page.getByLabel('Jūsų klausimas').fill('O kaip padėkoti?');
      await capture('assistant-typing');
      await page.setViewportSize({ width, height });
      await page.getByLabel('Jūsų klausimas').blur();
    }
    await page.getByRole('button', { name: 'Į pradžią', exact: true }).click();
    await page.getByRole('button', { name: 'Versti pokalbį', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Galite kalbėti', exact: true })).toBeVisible();
    await capture('live-ready');
    await say(page, 'in', 'input', 'Norėtume staliuko šešiems rytoj penkioliktą trisdešimt.', 0);
    await say(page, 'out', 'output', 'Θα θέλαμε ένα τραπέζι για έξι άτομα αύριο στις δεκαπέντε και τριάντα.', 200);
    await capture('live');
    await page.getByRole('button', { name: /^Pasirinkti vertimą:/ }).click();
    await capture('selected');
    await page.getByRole('button', { name: 'Parodyti žmogui', exact: true }).click();
    await capture('show');
    await say(page, 'reply-in', 'input', 'Ναι, εντάξει. Τα λέμε αύριο.', 4000);
    await say(page, 'reply-out', 'output', 'Taip, gerai. Iki rytojaus.', 5000);
    await capture('show-reply');
    await page.getByRole('button', { name: 'Grįžti', exact: true }).click();
    await page.getByRole('button', { name: 'Daugiau veiksmų', exact: true }).click();
    await capture('live-menu');
    await page.getByRole('button', { name: 'Ką sutarėme?', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('15:30');
    await capture('recap');
    await page.getByRole('button', { name: 'Grįžti į pokalbį', exact: true }).click();
    await page.getByRole('button', { name: 'Rodyti naujausią', exact: true }).click();
    await page.getByRole('button', { name: 'Pauzė', exact: true }).click();
    await capture('paused');
    await page.getByRole('button', { name: 'Baigti pokalbį', exact: true }).click();
    await capture('ended');
    await context.close();
  }
  await writeFile(`${output}/geometry.json`, JSON.stringify(measurements, null, 2));
} finally { await browser.close(); }
