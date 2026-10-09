import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserDelivery, prepareBrowserNotification, publishNotification } from '../server/ntfy';
import { ServiceError } from '../server/openai';

const notification = { title: 'Patikra · ąčę', message: 'Bandomasis tekstas.', click: 'https://trip.example/stats' };

test('ntfy accepts a copied topic name and full URLs, preserving JSON and authentication', async () => {
  for (const [value, expectedURL, topic] of [
    [' dode-graikija\n', 'https://ntfy.sh/', 'dode-graikija'],
    ['https://ntfy.sh/dode-graikija', 'https://ntfy.sh/', 'dode-graikija'],
    ['https://push.example/base/topic/?x=1#ignored', 'https://push.example/base/', 'topic'],
  ]) {
    let sent = 0;
    await publishNotification({ NTFY_TOPIC_URL: value, NTFY_TOKEN: 'test-token' }, notification, async (url, init) => {
      sent++;
      assert.equal(String(url), expectedURL);
      assert.equal(init?.method, 'POST');
      assert.equal(init?.redirect, 'manual');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token');
      assert.deepEqual(JSON.parse(String(init?.body)), { ...notification, topic });
      return Response.json({ id: 'accepted' });
    });
    assert.equal(sent, 1);
  }
});

test('invalid ntfy settings fail before sending any content', async () => {
  for (const value of ['', ' ', 'not a url', 'https://ntfy.sh/', 'file:///topic', 'https://user:password@ntfy.sh/topic']) {
    await assert.rejects(publishNotification({ NTFY_TOPIC_URL: value }, notification, async () => { assert.fail('Must not send'); }), error => error instanceof ServiceError && ['ntfy_not_configured', 'ntfy_invalid_topic'].includes(error.code));
  }
});

test('ntfy diagnostics distinguish access, quota and HTTP failures without echoing private responses', async () => {
  for (const [status, code] of [[401, 'ntfy_auth'], [403, 'ntfy_auth'], [429, 'ntfy_rate_limit'], [503, 'ntfy_http'], [302, 'ntfy_http']] as const) {
    await assert.rejects(publishNotification({ NTFY_TOPIC_URL: 'topic', NTFY_TOKEN: 'private-token' }, notification, async () => new Response('private upstream content and private-token', { status })), error => {
      assert.ok(error instanceof ServiceError);
      assert.equal(error.status, 502);
      assert.equal(error.code, code);
      assert.ok(error.message.includes(String(status)));
      assert.ok(!error.message.includes('private'));
      return true;
    });
  }
  await assert.rejects(publishNotification({ NTFY_TOPIC_URL: 'topic' }, notification, async () => { throw new Error('private network data'); }), error => error instanceof ServiceError && error.code === 'ntfy_network' && !error.message.includes('private'));
});

test('browser payloads are limited to public ntfy.sh and never expose server tokens', () => {
  const config = { STATS_ADMIN_PASSWORD: 'private-password', NTFY_TOPIC_URL: 'dode-graikija', NTFY_DELIVERY: 'browser' };
  assert.equal(browserDelivery(config), true);
  assert.equal(browserDelivery({ ...config, NTFY_TOKEN: 'private-token' }), false);
  assert.ok(!JSON.stringify(prepareBrowserNotification(config, notification)).includes('private'));
  for (const extra of [{ NTFY_TOKEN: 'private-token' }, { NTFY_TOPIC_URL: 'https://elsewhere.example/topic' }, { NTFY_TOPIC_URL: 'https://ntfy.sh/base/topic' }]) {
    assert.throws(() => prepareBrowserNotification({ ...config, ...extra }, notification), error => error instanceof ServiceError && error.code === 'ntfy_browser_config');
  }
});
