import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createOpenAIRequest, ServiceError } from '../server/openai';
import { ApiError, request } from '../src/lib/api';

const stalledBody: typeof fetch = async (_input, init) => new Response(new ReadableStream({
  start(stream) {
    stream.enqueue(new TextEncoder().encode('{"text":"'));
    init!.signal!.addEventListener('abort', () => stream.error(init!.signal!.reason), { once: true });
  },
}), { headers: { 'Content-Type': 'application/json' } });

test('provider deadline covers a response body that stalls after headers', { timeout: 500 }, async () => {
  const upstream = createOpenAIRequest('test-key', stalledBody);
  await Promise.all([
    assert.rejects(async () => (await upstream('responses', {}, 20)).json(), error => error instanceof ServiceError && error.status === 504),
    delay(60),
  ]);
});

test('provider deadlines are cleared after consumption or cancellation', async () => {
  const signals: AbortSignal[] = [];
  const upstream = createOpenAIRequest('test-key', async (_input, init) => {
    signals.push(init!.signal!);
    return Response.json({ text: 'Ačiū' });
  });
  assert.deepEqual(await (await upstream('responses', {}, 20)).json(), { text: 'Ačiū' });
  await (await upstream('audio/speech', {}, 20)).body!.cancel();
  await delay(40);
  assert.ok(signals.every(signal => !signal.aborted));
});

test('browser deadline and cancellation cover the whole response body', { timeout: 500 }, async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'navigator', original); else Reflect.deleteProperty(globalThis, 'navigator'); });
  t.mock.method(globalThis, 'fetch', stalledBody);

  await assert.rejects(async () => (await request('/api/chat', {}, undefined, 20)).json(), ApiError);
  const abort = new AbortController();
  const pending = request('/api/chat', {}, abort.signal);
  await delay(0);
  abort.abort();
  await assert.rejects(pending, { name: 'AbortError' });

  t.mock.method(globalThis, 'fetch', async () => Response.json({ text: 'Ačiū' }));
  assert.deepEqual(await (await request('/api/chat', {})).json(), { text: 'Ačiū' });
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal((await request('/api/live/end', {})).status, 204);
});
