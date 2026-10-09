import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockStatsLive } from './fixtures/stats-live';
import { mockLive } from './fixtures/live';

test('admin can end a call remotely and sees confirmation only after the server responds', async ({ page }) => {
  const mock = await mockStatsLive(page);
  mock.hold();
  await page.goto(mock.path);
  const dialog = page.getByRole('dialog', { name: 'Balso pokalbis' });
  await expect(dialog.getByText('Pokalbis pradėtas', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Baigti pokalbį', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Baigiame…', exact: true })).toBeDisabled();
  await expect(dialog.getByText('Pokalbis baigtas', { exact: true })).toHaveCount(0);
  await expect.poll(mock.requests).toBe(1);
  mock.release();
  await expect(dialog.getByText('Pokalbis baigtas', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Μπορούμε να παρκάρουμε εδώ;', { exact: true })).toBeVisible();
  await expect(dialog.locator('.stats-live-control button')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Pokalbis baigtas', { exact: true })).toBeVisible();
  expect(mock.requests()).toBe(1);
});

test('unconfirmed close and network errors stay explicit and can recover', async ({ page }) => {
  const mock = await mockStatsLive(page);
  mock.setOutcome('network');
  await page.goto(mock.path);
  await page.getByRole('button', { name: 'Baigti pokalbį', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Nepavyko pasiekti serverio');
  await expect(page.getByText('Pokalbis baigtas', { exact: true })).toHaveCount(0);
  mock.setOutcome('closing');
  await page.getByRole('button', { name: 'Baigti pokalbį', exact: true }).click();
  await expect(page.getByText('Uždarymas dar nepatvirtintas', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Uždarymas dar nepatvirtintas', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  mock.setOutcome('ended');
  await page.getByRole('button', { name: 'Bandyti užbaigti dabar', exact: true }).click();
  await expect(page.getByText('Pokalbis baigtas', { exact: true })).toBeVisible();
});

test('a remote hangup stops the phone microphone and does not automatically create another paid call', async ({ page }) => {
  await page.clock.install();
  const connections = await mockLive(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Versti pokalbį', exact: true }).click();
  await expect(page.getByText('Galite kalbėti', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).fakePeer.channel.emit({ type: 'session.closed', reason: 'close_requested', usage: { seconds: 12 } }));
  await expect(page.getByText('Ačiū už pokalbį.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).captureStreams.every((stream: MediaStream) => stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true);
  await page.clock.fastForward(30_000);
  expect(connections).toHaveLength(1);
});

test('a late history poll cannot make a confirmed ended session appear active again', async ({ page }) => {
  await page.clock.install();
  const mock = await mockStatsLive(page);
  await page.goto(mock.path);
  await expect(page.getByRole('button', { name: 'Baigti pokalbį', exact: true })).toBeVisible();
  mock.holdRead();
  await page.clock.fastForward(15_100);
  await expect.poll(mock.waitingRead).toBe(true);
  await page.getByRole('button', { name: 'Baigti pokalbį', exact: true }).click();
  await expect(page.getByText('Pokalbis baigtas', { exact: true })).toBeVisible();
  mock.releaseRead();
  await expect.poll(mock.readReleased).toBe(true);
  await expect(page.getByText('Vėliau gautas tekstas.', { exact: true })).toBeVisible();
  await expect(page.getByText('Pokalbis baigtas', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baigti pokalbį', exact: true })).toHaveCount(0);
});
