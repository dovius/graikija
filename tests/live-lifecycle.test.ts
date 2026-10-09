import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createOpenAIRequest, ServiceError } from '../server/openai';
import { StatsStore } from '../server/stats-store';
import { StatsService } from '../server/stats-service';
import { adminCookie } from '../server/stats-auth';
import { LIVE_RETRY_MS, MAX_LIVE_MS } from '../server/live-limits';

const visitor = 'a'.repeat(64);
const origin = 'https://trip.example';
const password = 'lifecycle-test-password';
const missing = () => Response.json({ error: { code: 'session_id_not_found' } }, { status: 404 });

function fixture(fetcher: typeof fetch) {
  const db = new DatabaseSync(':memory:');
  const query = (sql: string, ...values: (string | number | null)[]) => db.prepare(sql).all(...values);
  const store = new StatsStore(query, run => {
    db.exec('BEGIN');
    try { const value = run(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  const service = new StatsService(store, { STATS_ADMIN_PASSWORD: password, OPENAI_API_KEY: 'lifecycle-test-key', APP_ORIGIN: origin }, fetcher);
  return { db, store, service, query };
}

test('only an explicit missing session on the hangup endpoint is idempotent', async () => {
  const upstream = createOpenAIRequest('test-key', async () => missing());
  assert.equal((await upstream('live/sessions/live_test/hangup')).status, 204);
  await assert.rejects(upstream('live/sessions'), ServiceError);
  await assert.rejects(upstream('responses'), ServiceError);
  for (const [status, code] of [[404, 'model_not_found'], [401, 'session_id_not_found'], [403, 'session_id_not_found'], [500, 'session_id_not_found']] as const) {
    const failed = createOpenAIRequest('test-key', async () => Response.json({ error: { code, message: 'private diagnostic' } }, { status }));
    await assert.rejects(failed('live/sessions/live_test/hangup'), error => error instanceof ServiceError && !error.message.includes('private'));
  }
  const malformed = createOpenAIRequest('test-key', async () => new Response('not JSON', { status: 404 }));
  await assert.rejects(malformed('live/sessions/live_test/hangup'), ServiceError);
});

test('old active rows are reconciled with the provider while current calls are left alone', async () => {
  const calls: string[] = [];
  const f = fixture(async url => { calls.push(String(url)); return missing(); });
  try {
    await f.service.record({ action: 'live', visitor, sessionId: 'live_old' });
    await f.service.record({ action: 'live', visitor, sessionId: 'live_current' });
    f.query('UPDATE stats_events SET created_at = ?, updated_at = ? WHERE conversation_id = ?', Date.now() - MAX_LIVE_MS - 1000, Date.now() - MAX_LIVE_MS - 1000, 'live_old');
    await f.service.reconcileLive();
    assert.equal(f.store.event(`${visitor}-live_old`)!.status, 'ended');
    assert.equal(f.store.event(`${visitor}-live_current`)!.status, 'active');
    assert.deepEqual(calls, ['https://api.openai.com/v1/live/sessions/live_old/hangup']);
    await f.service.reconcileLive();
    assert.equal(calls.length, 1);
    assert.ok(f.store.nextLiveCheck()! > Date.now());
  } finally { f.db.close(); }
});

test('failed hangups remain unconfirmed and retry after service recreation', async () => {
  let fail = true;
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return fail ? new Response(null, { status: 503 }) : new Response(null, { status: 204 }); };
  const f = fixture(fetcher);
  try {
    await f.service.record({ action: 'live', visitor, sessionId: 'live_retry' });
    const id = `${visitor}-live_retry`;
    assert.equal(await f.service.endLive(id), false);
    assert.equal(f.store.event(id)!.status, 'closing');
    await f.service.reconcileLive();
    assert.equal(calls, 1, 'background retries respect the delay');
    f.query('UPDATE stats_events SET updated_at = ? WHERE id = ?', Date.now() - LIVE_RETRY_MS - 1000, id);
    fail = false;
    const recreated = new StatsService(f.store, { ...f.service.config }, fetcher);
    await recreated.reconcileLive();
    assert.equal(calls, 2);
    assert.equal(f.store.event(id)!.status, 'ended');
    await recreated.record({ action: 'closing', visitor, sessionId: 'live_retry' });
    assert.equal(f.store.event(id)!.status, 'ended', 'a late failed retry cannot reopen an ended row');
    assert.equal(f.store.nextLiveCheck(), null);
  } finally { f.db.close(); }
});

test('admin hangup checks authentication, origin and stored ownership before contacting OpenAI', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; return new Response(null, { status: 204 }); });
  try {
    await f.service.record({ action: 'live', visitor, sessionId: 'live_admin' });
    await f.service.record({ action: 'speech', visitor, text: 'Καλημέρα' });
    const cookie = (await adminCookie(password, true)).split(';')[0];
    const id = `${visitor}-live_admin`;
    const end = (eventId = id, headers: Record<string, string> = {}) => f.service.handle(new Request(`${origin}/api/stats/events/${eventId}/end`, { method: 'POST', headers: { Origin: origin, Cookie: cookie, ...headers } }), 'test-client');
    assert.equal((await end(id, { Cookie: '' })).status, 401);
    assert.equal((await end(id, { Origin: 'https://elsewhere.example' })).status, 403);
    assert.equal((await end(`${visitor}-not-in-history`)).status, 404);
    assert.equal(calls, 0);
    assert.equal((await end()).status, 200);
    assert.equal(calls, 1);
    assert.equal(f.store.event(id)!.status, 'ended');
    assert.equal((await end()).status, 200);
    assert.equal(calls, 1, 'repeated admin clicks do not repeat a confirmed hangup');
  } finally { f.db.close(); }
});

test('concurrent admin requests share one hangup and failures return pending, never ended', async () => {
  let release!: () => void;
  let calls = 0;
  const f = fixture(async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); return new Response(null, { status: 500 }); });
  try {
    await f.service.record({ action: 'live', visitor, sessionId: 'live_concurrent' });
    const id = `${visitor}-live_concurrent`;
    const first = f.service.endLive(id);
    const second = f.service.endLive(id);
    assert.equal(calls, 1);
    release();
    assert.deepEqual(await Promise.all([first, second]), [false, false]);
    const cookie = (await adminCookie(password, true)).split(';')[0];
    const pending = f.service.handle(new Request(`${origin}/api/stats/events/${id}/end`, { method: 'POST', headers: { Origin: origin, Cookie: cookie } }), 'test-client');
    while (calls < 2) await new Promise(resolve => setImmediate(resolve));
    release();
    const response = await pending;
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { status: 'closing' });
  } finally { f.db.close(); }
});
