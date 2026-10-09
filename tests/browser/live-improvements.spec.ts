import { test, expect, type Page } from '@playwright/test';
import { mockLive } from './fixtures/live';

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Versti pokalbį', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Galite kalbėti', exact: true })).toBeVisible();
}
async function caption(page: Page, id: string, role: 'user' | 'assistant', text: string, at: number) {
  await page.evaluate(({ id, role, text, at }) => (window as any).fakePeer.channel.emit({ type: role === 'user' ? 'session.input_transcript.delta' : 'session.output_transcript.delta', event_id: id, delta: text, start_ms: at, end_ms: at + 500 }), { id, role, text, at });
}
const micEnabled = (page: Page) => page.evaluate(() => (window as any).captureStreams.at(-1).getTracks()[0].enabled);
// Valid silent PCM avoids racing the browser's decoder-error path while the
// test controls play/ended. An arbitrary text blob is not a playback fixture.
const silentWav = Buffer.alloc(44 + 48000);
silentWav.write('RIFF'); silentWav.writeUInt32LE(silentWav.length - 8, 4); silentWav.write('WAVEfmt ', 8);
silentWav.writeUInt32LE(16, 16); silentWav.writeUInt16LE(1, 20); silentWav.writeUInt16LE(1, 22);
silentWav.writeUInt32LE(24000, 24); silentWav.writeUInt32LE(48000, 28); silentWav.writeUInt16LE(2, 32); silentWav.writeUInt16LE(16, 34);
silentWav.write('data', 36); silentWav.writeUInt32LE(48000, 40);

test('Home starts fresh; resume and reconnect retain only the chosen conversation', async ({ page }) => {
  const connections = await mockLive(page);
  await start(page);
  await caption(page, 'old', 'user', 'Viešbutis prie oro uosto.', 0);
  await page.getByRole('button', { name: 'Daugiau veiksmų', exact: true }).click();
  await page.getByLabel('Kas dabar kalba?').selectOption('toGreek');
  await expect(page.getByLabel('Kas dabar kalba?')).toHaveValue('toGreek');
  await page.getByRole('button', { name: 'Uždaryti', exact: true }).click();
  await expect(page.locator('.live-direction')).toContainText('Lietuvių → Graikų');
  await page.getByRole('button', { name: 'Baigti pokalbį', exact: true }).click();
  await page.getByRole('button', { name: 'Tęsti pokalbį', exact: true }).click();
  await expect.poll(() => connections.length).toBe(2);
  expect(connections[1].conversationId).toBe(connections[0].conversationId);
  expect(connections[1].history[0].text).toBe('Viešbutis prie oro uosto.');
  await page.getByRole('button', { name: 'Į pradžią', exact: true }).click();
  await page.getByRole('button', { name: 'Versti pokalbį', exact: true }).click();
  await expect.poll(() => connections.length).toBe(3);
  await expect(page.getByRole('heading', { name: 'Galite kalbėti', exact: true })).toBeVisible();
  expect(connections[2].history).toEqual([]);
  expect(connections[2].preferences.direction).toBe('auto');
  expect(connections[2].conversationId).not.toBe(connections[0].conversationId);
  await expect(page.locator('.captions')).toHaveCount(0);
  await caption(page, 'new', 'user', 'Norėtume sąskaitos.', 0);
  await page.evaluate(() => { const peer = (window as any).fakePeer; peer.connectionState = 'failed'; peer.onconnectionstatechange(); });
  await expect.poll(() => connections.length).toBe(4);
  expect(connections[3].history).toEqual([{ role: 'user', text: 'Norėtume sąskaitos.' }]);
  await page.getByRole('button', { name: 'Daugiau veiksmų', exact: true }).click();
  await page.getByRole('button', { name: 'Ankstesni pokalbiai', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Viešbutis prie oro uosto.');
});

test('selected phrase survives late captions and showing text continues to hear the reply', async ({ page }) => {
  await mockLive(page);
  await start(page);
  await caption(page, 'translation', 'assistant', 'Θα θέλαμε ένα τραπέζι για έξι άτομα.', 0);
  await caption(page, 'short', 'assistant', 'Mhm.', 4000);
  await page.getByRole('button', { name: 'Pasirinkti vertimą: Θα θέλαμε ένα τραπέζι για έξι άτομα.', exact: true }).click();
  await caption(page, 'late', 'assistant', ' Παρακαλώ.', 500);
  await page.getByRole('button', { name: 'Parodyti žmogui', exact: true }).click();
  await expect(page.locator('.translation-display p')).toHaveText('Θα θέλαμε ένα τραπέζι για έξι άτομα.');
  expect(await micEnabled(page)).toBe(true);
  await caption(page, 'reply-in', 'user', 'Ναι, στις δεκαπέντε και τριάντα.', 7000);
  await caption(page, 'reply-out', 'assistant', 'Taip, penkioliktą trisdešimt.', 7500);
  await expect(page.locator('.show-reply')).toContainText('penkioliktą trisdešimt');
  await page.getByRole('button', { name: 'Grįžti', exact: true }).click();
  await expect(page.locator('.chosen-translation p')).toHaveText('Θα θέλαμε ένα τραπέζι για έξι άτομα.');
});

test('slow replay uses the selected exact text, pauses capture and restores it after playback', async ({ page }) => {
  await mockLive(page);
  let speech: { text: string } | undefined;
  await page.route('**/api/speech', route => { speech = route.request().postDataJSON(); return route.fulfill({ body: silentWav, contentType: 'audio/wav' }); });
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () { (window as any).playedAudio = this; return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () {};
  });
  await start(page);
  await caption(page, 'six', 'assistant', 'Έξι.', 0);
  await page.getByRole('button', { name: 'Daugiau veiksmų', exact: true }).click();
  await page.getByRole('button', { name: 'Pakartoti lėčiau', exact: true }).click();
  await expect.poll(() => speech?.text).toBe('Έξι.');
  await expect.poll(() => micEnabled(page)).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as any).playedAudio?.playbackRate)).toBe(0.78);
  await page.evaluate(() => (window as any).playedAudio.dispatchEvent(new Event('ended')));
  await expect.poll(() => micEnabled(page)).toBe(true);
});

for (const steering of ['accept', 'reject', 'timeout'] as const) {
  test(`direction changes require a matching acknowledgement: ${steering}`, async ({ page }) => {
    const connections = await mockLive(page, { steering });
    await start(page);
    await page.getByRole('button', { name: 'Daugiau veiksmų', exact: true }).click();
    await page.getByLabel('Kas dabar kalba?').selectOption('toGreek');
    if (steering === 'accept') {
      await expect(page.getByLabel('Kas dabar kalba?')).toHaveValue('toGreek');
      const event = await page.evaluate(() => (window as any).sentEvents.find((item: any) => item.type === 'session.instructions.append'));
      expect(event.content).toContain('tik į graikų kalbą');
      expect(event.delegation_id).toBeNull();
      expect(connections).toHaveLength(1);
    } else {
      await expect(page.getByRole('alert')).toContainText('Nustatymo nepavyko patvirtinti');
      await expect(page.getByLabel('Kas dabar kalba?')).toHaveValue('auto');
      if (steering === 'timeout') { await expect.poll(() => connections.length, { timeout: 12000 }).toBe(2); expect(connections[1].preferences.direction).toBe('auto'); }
    }
  });
}

test('recap uses only this conversation, pauses listening and reuses its saved snapshot', async ({ page }) => {
  await mockLive(page);
  await page.route('**/api/speech', route => route.fulfill({ body: silentWav, contentType: 'audio/wav' }));
  await page.addInitScript(() => {
    (window as any).blockNoteSound = true;
    HTMLMediaElement.prototype.play = function () { return (window as any).blockNoteSound ? Promise.reject(new DOMException('Blocked', 'NotAllowedError')) : Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () {};
  });
  const requests: any[] = [];
  await page.route('**/api/chat', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { text: 'Žmonių skaičius: šeši.', sources: [], agreement: { fields: [{ label: 'Žmonių skaičius', value: 'Šeši', status: 'heard', evidence: [{ id: 'people', quote: 'Είμαστε έξι.' }] }], questions: ['Kurią dieną?'] } } }); });
  await start(page);
  await caption(page, 'people', 'user', 'Είμαστε έξι.', 0);
  await page.getByRole('button', { name: 'Daugiau veiksmų', exact: true }).click();
  await page.getByRole('button', { name: 'Ką sutarėme?', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Šeši');
  expect(await micEnabled(page)).toBe(false);
  expect(requests[0].purpose).toBe('recap');
  expect(requests[0].transcript).toEqual([{ id: 'people', role: 'user', text: 'Είμαστε έξι.' }]);
  await page.getByText('Kas buvo pasakyta', { exact: true }).click();
  await expect(page.getByRole('blockquote')).toHaveText('Είμαστε έξι.');
  await page.getByRole('button', { name: 'Grįžti į pokalbį', exact: true }).click();
  await expect.poll(() => micEnabled(page)).toBe(true);
  await page.getByRole('button', { name: 'Daugiau veiksmų', exact: true }).click();
  await page.getByRole('button', { name: 'Ką sutarėme?', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Šeši');
  expect(requests).toHaveLength(1);
  await page.getByRole('dialog').getByRole('button', { name: 'Išklausyti', exact: true }).click();
  const play = page.getByRole('dialog').getByRole('button', { name: 'Paleisti garsą', exact: true });
  await expect(play).toBeVisible();
  await page.evaluate(() => { (window as any).blockNoteSound = false; });
  await play.click();
  await expect(page.getByRole('dialog').getByRole('alert')).not.toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Stabdyti garsą', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Išklausyti', exact: true })).toBeVisible();
});

test('model captions cannot renew an unattended microphone', async ({ page }) => {
  await mockLive(page);
  await page.clock.install();
  await start(page);
  await page.clock.fastForward(90_000);
  await caption(page, 'assistant-only', 'assistant', 'Mhm.', 0);
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('heading', { name: 'Mikrofonas išjungtas', exact: true })).toBeVisible();
});

test('blocked Live playback pauses capture until the user enables sound', async ({ page }) => {
  await mockLive(page);
  await page.addInitScript(() => {
    (window as any).blockPlayback = true;
    HTMLMediaElement.prototype.play = function () { return (window as any).blockPlayback ? Promise.reject(new DOMException('Blocked', 'NotAllowedError')) : Promise.resolve(); };
  });
  await start(page);
  await page.evaluate(() => {
    const context = new AudioContext();
    (window as any).testAudioContext = context;
    const track = context.createMediaStreamDestination().stream.getAudioTracks()[0];
    (window as any).fakePeer.ontrack({ track });
  });
  await expect(page.getByRole('heading', { name: 'Įjunkite garsą', exact: true })).toBeVisible();
  await expect.poll(() => micEnabled(page)).toBe(false);
  await page.evaluate(() => { (window as any).blockPlayback = false; });
  await page.getByRole('button', { name: 'Įjungti garsą', exact: true }).click();
  await expect.poll(() => micEnabled(page)).toBe(true);
  await page.evaluate(() => (window as any).testAudioContext.close());
});

test('captions follow a resize but do not pull a reader away from earlier text', async ({ page }) => {
  await mockLive(page);
  await start(page);
  for (let index = 0; index < 12; index++) await caption(page, `line-${index}`, 'assistant', `Vertimas numeris ${index}.`, index * 3000);
  await page.locator('.captions').evaluate(element => {
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -800 }));
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await caption(page, 'later', 'assistant', 'Pats naujausias vertimas.', 40000);
  expect(await page.locator('.captions').evaluate(element => element.scrollTop)).toBe(0);
  await page.getByRole('button', { name: 'Naujausias vertimas', exact: true }).click();
  await expect.poll(() => page.locator('.captions').evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 640 });
  await expect.poll(() => page.locator('.captions').evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(2);
});
