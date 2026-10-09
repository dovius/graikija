import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chatPayload, livePayload, speechPayload } from '../../server/payloads';
import { chatSchema, sessionSchema } from '../../server/validation';

// Both real HTTP adapters must forward the exact same shared Greek payloads.
// Providers are injected/intercepted by their enclosing test suites.
export async function greekAdapterContract(send: (path: string, body: unknown) => Promise<number>, latest: () => unknown) {
  for (const mode of ['assistant', 'photo'] as const) {
    const body = { requestId: randomUUID(), mode, messages: [{ role: 'user', text: 'Τι είναι αυτό;' }], ...(mode === 'photo' ? { image: 'data:image/png;base64,iVBORw0KGgo=' } : {}) };
    assert.equal(await send('/api/chat', body), 200);
    const expected = chatPayload(chatSchema.parse(body), {});
    assert.deepEqual(latest(), expected);
    assert.match(expected.instructions, /Rodo sala.*Ρόδος/);
  }
  const explain = { requestId: randomUUID(), mode: 'assistant', purpose: 'explain', transcript: [{ id: 'heard', role: 'user', text: 'Είμαστε έξι.' }], messages: [{ role: 'user', text: 'Paaiškink man' }] };
  assert.equal(await send('/api/chat', explain), 200);
  assert.deepEqual(latest(), chatPayload(chatSchema.parse(explain), {}));
  for (const direction of ['auto', 'toGreek', 'toLithuanian'] as const) {
    const body = { sdp: 'v=0\r\nsynthetic-greek-parity-offer', preferences: { direction, slow: true } };
    assert.equal(await send('/api/live/session', body), 201);
    assert.deepEqual(latest(), livePayload(sessionSchema.parse(body), {}));
  }
  assert.equal(await send('/api/speech', { text: 'Καλημέρα!' }), 200);
  assert.deepEqual(latest(), speechPayload('Καλημέρα!', {}));
}
