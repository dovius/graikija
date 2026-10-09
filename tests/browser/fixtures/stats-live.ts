import type { Page } from '@playwright/test';
import type { Activity, StatsPage } from '../../../shared/stats';

export async function mockStatsLive(page: Page) {
  const visitor = 'd'.repeat(64);
  const event: Activity = {
    id: `${visitor}-live_test`, visitorId: visitor, visitorName: 'Keliautojas', kind: 'live', conversationId: 'live_test',
    createdAt: Date.now() - 60_000, updatedAt: Date.now(), status: 'active', text: 'Ar galime čia statyti?', answer: 'Μπορούμε να παρκάρουμε εδώ;', error: '', imageId: null, imageName: '', sources: [], notification: 'off',
    fragments: [{ id: 'input', session: 'live_test', role: 'user', text: 'Ar galime čia statyti?', start: 0, end: 1500 }, { id: 'output', session: 'live_test', role: 'assistant', text: 'Μπορούμε να παρκάρουμε εδώ;', start: 1800, end: 3200 }],
  };
  let requested = 0;
  let outcome: 'closing' | 'ended' | 'network' = 'ended';
  let hold = false;
  let release: (() => void) | undefined;
  let holdRead = false;
  let releaseRead: (() => void) | undefined;
  let readReleased = false;
  await page.route('**/api/stats**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/end')) {
      requested++;
      if (hold) { hold = false; await new Promise<void>(resolve => { release = resolve; }); }
      if (outcome === 'network') { await route.abort('failed'); return; }
      event.status = outcome;
      await route.fulfill({ status: outcome === 'closing' ? 202 : 200, json: { status: outcome } });
      return;
    }
    if (url.pathname.includes('/events/')) {
      const snapshot = structuredClone(event);
      if (holdRead) {
        holdRead = false;
        snapshot.fragments!.push({ id: 'late', session: 'live_test', role: 'user', text: 'Vėliau gautas tekstas.', start: 5000, end: 6000 });
        await new Promise<void>(resolve => { releaseRead = resolve; });
      }
      await route.fulfill({ json: snapshot });
      if (releaseRead) readReleased = true;
      return;
    }
    const data: StatsPage = { events: [{ ...event, fragments: undefined }], total: 1, page: 1, pages: 1, counts: { live: 1, question: 0, photo: 0, dictation: 0, speech: 0 }, visitors: [{ id: visitor, name: event.visitorName, count: 1, lastSeen: event.updatedAt }], retentionDays: 30, ntfyConfigured: false, notificationFailures: 0 };
    await route.fulfill({ json: data });
  });
  return { path: `/stats?event=${event.id}`, requests: () => requested, setOutcome: (value: typeof outcome) => { outcome = value; }, hold: () => { hold = true; }, release: () => release?.(), holdRead: () => { holdRead = true; }, waitingRead: () => Boolean(releaseRead), releaseRead: () => releaseRead?.(), readReleased: () => readReleased };
}
