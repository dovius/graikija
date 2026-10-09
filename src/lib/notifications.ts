import type { BrowserPublish, NotificationClaim } from '../../shared/notifications';

export async function publishFromBrowser(publish: BrowserPublish) {
  // Only the public ntfy JSON endpoint is allowed by both this client and CSP.
  // Server/API credentials and cookies are never forwarded with a notification.
  if (publish.url !== 'https://ntfy.sh/' || !/^[A-Za-z0-9_-]+$/.test(publish.payload.topic)) throw new Error('Neteisingas „ntfy“ temos adresas.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(publish.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(publish.payload), credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', keepalive: true, signal: controller.signal });
    await response.body?.cancel().catch(() => {});
    if (response.status === 429) throw new Error('„ntfy“ siuntimo limitas šiam įrenginiui pasiektas (HTTP 429). Pabandykite vėliau.');
    if (!response.ok) throw new Error(`„ntfy“ atmetė pranešimą (HTTP ${response.status}). Patikrinkite temos prieigą.`);
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) throw new Error('Nepavyko susisiekti su „ntfy“. Patikrinkite interneto ryšį ir bandykite dar kartą.');
    throw error;
  } finally { clearTimeout(timeout); }
}

type Acknowledgement = { id: string; revision: number; lease: string; success: boolean };
let users = 0;
let enabled = false;
let checked = false;
let sending = false;
let awakened = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let acknowledgement: Acknowledgement | null = null;

async function localRequest(path: string, body?: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try { return await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), keepalive: true, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}
async function acknowledge() {
  if (!acknowledgement) return;
  const sent = acknowledgement;
  const result = await localRequest('/api/notifications/ack', sent);
  // Another tab may have recovered an expired lease. Its newer send owns it.
  if (!result.ok && result.status !== 403) throw new Error('Acknowledgement failed');
  if (acknowledgement === sent) acknowledgement = null;
}
async function flush() {
  if (sending || !users || !navigator.onLine || document.visibilityState === 'hidden') return;
  sending = true; awakened = false;
  try {
    if (!checked) {
      const result = await localRequest('/api/notifications');
      if (!result.ok) throw new Error('Notification configuration unavailable');
      enabled = Boolean((await result.json() as { enabled: boolean }).enabled); checked = true;
    }
    if (acknowledgement) await acknowledge();
    if (!enabled) return;
    for (let count = 0; count < 5; count++) {
      const response = await localRequest('/api/notifications/claim', {});
      if (!response.ok) throw new Error('Notification queue unavailable');
      const data = await response.json() as NotificationClaim;
      enabled = data.enabled;
      if (!data.job) break;
      const { id, revision, lease } = data.job;
      let success = false;
      try { await publishFromBrowser(data.job); success = true; }
      catch { /* Keep the failure in the durable queue without interrupting translation. */ }
      acknowledgement = { id, revision, lease, success };
      await acknowledge();
      if (!success || !users) break;
    }
  } catch { /* Online/visibility events and a short poll retry transient outages. */ }
  finally {
    sending = false;
    if (users && (enabled || !checked || acknowledgement)) schedule(awakened ? 100 : 15_000);
  }
}
function schedule(delay = 50) {
  clearTimeout(timer);
  if (users) timer = setTimeout(() => { timer = undefined; void flush(); }, delay);
}
function wake() { awakened = true; schedule(); }
function visible() { if (document.visibilityState === 'visible') wake(); }
function leaving() { if (acknowledgement) void acknowledge().catch(() => {}); }

export function notificationActivity(response: Response) {
  if (response.headers.get('X-Trip-Notifications') === 'browser') { enabled = true; checked = true; wake(); }
}
export function startBrowserNotifications() {
  if (users++ === 0) {
    window.addEventListener('online', wake);
    window.addEventListener('pagehide', leaving);
    document.addEventListener('visibilitychange', visible);
    checked = false; wake();
  }
  return () => {
    if (--users === 0) {
      clearTimeout(timer);
      window.removeEventListener('online', wake);
      window.removeEventListener('pagehide', leaving);
      document.removeEventListener('visibilitychange', visible);
      leaving();
    }
  };
}
