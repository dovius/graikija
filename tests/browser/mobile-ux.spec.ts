import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockLive } from './fixtures/live';

test('small phone keeps the complete translation, pause and end controls separate and reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockLive(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Versti pokalbį', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Galite kalbėti', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const channel = (window as any).fakePeer.channel;
    channel.emit({ type: 'session.input_transcript.delta', event_id: 'in', delta: 'Norėtume staliuko šešiems rytoj penkioliktą trisdešimt.', start_ms: 0, end_ms: 1000 });
    channel.emit({ type: 'session.output_transcript.delta', event_id: 'out', delta: 'Θα θέλαμε ένα τραπέζι για έξι άτομα αύριο στις δεκαπέντε και τριάντα.', start_ms: 200, end_ms: 1200 });
  });
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 640 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(size);
    for (const name of ['Pakartoti', 'Parodyti žmogui', 'Pauzė', 'Baigti pokalbį', 'Daugiau veiksmų']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeInViewport({ ratio: 1 });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(52);
    }
    const geometry = await page.evaluate(() => {
      const caption = document.querySelector('.caption.assistant .caption-text')!.getBoundingClientRect();
      const area = document.querySelector('.captions')!.getBoundingClientRect();
      const controls = document.querySelector('.live-controls')!.getBoundingClientRect();
      return { top: caption.top, bottom: caption.bottom, areaTop: area.top, controlsTop: controls.top, width: document.documentElement.scrollWidth };
    });
    expect(geometry.width).toBeLessThanOrEqual(size.width);
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.areaTop - 1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.controlsTop);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: /^Pasirinkti vertimą:/ }).click();
  await expect(page.locator('.chosen-translation p')).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Rodyti naujausią', exact: true }).click();
  await page.getByRole('button', { name: 'Pauzė', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Klausytis toliau', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Baigti pokalbį', exact: true })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Daugiau veiksmų', exact: true }).click();
  await page.locator('.live-menu-modal .modal-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(page.getByRole('button', { name: 'Uždaryti', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel('Kas dabar kalba?')).toBeInViewport({ ratio: 1 });
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(report.violations).toEqual([]);
});

test('a long answer opens at its beginning and leaves dictation and sending on screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  const first = 'Pirmiausia parodykite bilietą vairuotojui.';
  await page.route('**/api/chat', route => route.fulfill({ json: { text: `${first}\n\n${'Tai ilgesnis paaiškinimas, kurį galite ramiai perskaityti. '.repeat(30)}`, sources: [] } }));
  await page.goto('/#assistant');
  await page.getByLabel('Jūsų klausimas').fill('Kaip naudotis autobuso bilietu?');
  await page.getByRole('button', { name: 'Siųsti', exact: true }).click();
  await expect(page.getByText(first, { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Išklausyti', exact: true })).toBeInViewport({ ratio: 1 });
  await page.getByLabel('Jūsų klausimas').fill('O kur išlipti?');
  for (const label of ['Kalbėti', 'Siųsti']) await expect(page.getByRole('button', { name: label, exact: true })).toBeInViewport({ ratio: 1 });
  await page.locator('.chat-messages').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const answer = (await page.locator('.chat-messages').boundingBox())!;
  const composer = (await page.locator('.composer').boundingBox())!;
  expect(answer.y + answer.height).toBeLessThanOrEqual(composer.y);
});

test('showing a phrase keeps the new reply and the return button visible on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await mockLive(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Versti pokalbį', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Galite kalbėti', exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).fakePeer.channel.emit({ type: 'session.output_transcript.delta', event_id: 'first', delta: 'Θα θέλαμε ένα τραπέζι για έξι άτομα αύριο στις δεκαπέντε και τριάντα.', start_ms: 0, end_ms: 1000 }));
  await page.getByRole('button', { name: 'Parodyti žmogui', exact: true }).click();
  await page.evaluate(() => (window as any).fakePeer.channel.emit({ type: 'session.output_transcript.delta', event_id: 'second', delta: 'Taip, gerai. Iki rytojaus.', start_ms: 4000, end_ms: 5000 }));
  await expect(page.locator('.show-reply p')).toBeInViewport({ ratio: 1 });
  for (const name of ['Pakartoti', 'Grįžti', 'Baigti pokalbį', 'Uždaryti']) await expect(page.getByRole('dialog').getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => (window as any).captureStreams.at(-1).getTracks()[0].enabled)).toBe(true);
});

test('a reduced viewport while typing leaves the send button above the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.route('**/api/chat', route => route.fulfill({ json: { text: 'Bilietą parodykite vairuotojui.', sources: [] } }));
  await page.goto('/#assistant');
  await page.getByLabel('Jūsų klausimas').fill('Kaip važiuoti autobusu?');
  await page.getByRole('button', { name: 'Siųsti', exact: true }).click();
  await expect(page.locator('.message.assistant')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 380 });
  await page.getByLabel('Jūsų klausimas').fill('O kur išlipti?');
  await expect(page.getByRole('button', { name: 'Siųsti', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel('Jūsų klausimas')).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Siųsti', exact: true }).click();
  await expect(page.locator('.message.assistant')).toHaveCount(2);
});

test('larger text and landscape keep actions readable and allow scrolling without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const route of ['', '#photo', '#assistant']) {
    await page.goto(`/${route}`);
    await expect(page.locator('main h1')).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const buttons = route === '' ? page.locator('.action-card') : route === '#photo' ? page.locator('.photo-upload button') : page.locator('.composer-actions button');
    for (const button of await buttons.all()) {
      await button.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await expect(button).toBeInViewport({ ratio: 1 });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(52);
    }
  }
  await page.setViewportSize({ width: 740, height: 390 });
  await page.goto('/#photo');
  const upload = page.getByRole('button', { name: 'Pasirinkti iš nuotraukų', exact: true });
  await upload.scrollIntoViewIfNeeded();
  await expect(upload).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(740);
});
