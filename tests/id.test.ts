import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from '../src/lib/id.ts';

test('randomUUID uses the native generator when available', t => {
  const id = '00000000-0000-4000-8000-000000000000';
  t.mock.method(crypto, 'randomUUID', function (this: Crypto) { assert.equal(this, crypto); return id; });
  assert.equal(randomUUID(), id);
});

test('randomUUID produces valid UUID v4 IDs without the native method', t => {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  t.after(() => { if (descriptor) Object.defineProperty(crypto, 'randomUUID', descriptor); else Reflect.deleteProperty(crypto, 'randomUUID'); });
  const ids = Array.from({ length: 32 }, () => randomUUID());
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(new Set(ids).size, ids.length);
});
