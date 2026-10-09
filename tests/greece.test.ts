import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERPRETER_PROMPT, ASSISTANT_PROMPT, PHOTO_PROMPT, RECAP_PROMPT, EXPLAIN_PROMPT } from '../server/prompts';
import { readFileSync } from 'node:fs';
import { speechPayload } from '../server/payloads';
import { livePayload } from '../server/payloads';
import { sessionSchema } from '../server/validation';
import { DEFAULT_LIVE_PREFERENCES, livePreferenceInstructions } from '../shared/live';
import * as travel from '../shared/travel';

test('Greek app deployment, browser data, cookies and PWA have independent identities', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.name, 'graikija-vertejas');
  assert.deepEqual(config.routes, [{ pattern: 'graikija.vild.lt', custom_domain: true }]);
  assert.equal(config.workers_dev, true);
  const fallback = JSON.parse(readFileSync('wrangler.workers-dev.jsonc', 'utf8'));
  assert.deepEqual(fallback, { ...config, routes: [] });
  assert.ok(config.durable_objects.bindings.every((b: Record<string, string>) => !b.script_name));
  assert.match(readFileSync('src/lib/storage.ts', 'utf8'), /TRAVEL.id/);
  assert.match(readFileSync('vite.config.ts', 'utf8'), /cacheId: TRAVEL.id/);
  assert.match(readFileSync('index.html', 'utf8'), /Kelionės vertėjas · Graikija arčiau/);
  for (const file of ['server/app.ts', 'cloudflare/worker.ts']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /graikija_visitor/);
    assert.match(source, /graikija_access/);
  }
  assert.match(readFileSync('server/stats-auth.ts', 'utf8'), /graikija_stats_admin/);
  assert.match(readFileSync('server/stats-auth.ts', 'utf8'), /graikija-stats-session:/);
  for (const file of ['.env.example', '.dev.vars.example']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /dode-graikija/);
    assert.doesNotMatch(source, /dode-italiano/);
    assert.match(source, /^NTFY_TOPIC_URL=$/m); // Topic is explicit opt-in, not implicit publication.
  }
});

test('offline speech recognizes Greek script and uses Lithuanian for unaccented Lithuanian', () => {
  assert.equal(typeof travel.speechLocale, 'function');
  assert.equal(travel.TRAVEL.language, 'el');
  assert.equal(travel.TRAVEL.locale, 'el-GR');
  assert.equal(travel.speechLocale('Καλημέρα!'), 'el-GR');
  assert.equal(travel.speechLocale('Ρόδος'), 'el-GR');
  assert.equal(travel.speechLocale('Laba diena'), 'lt-LT');
  assert.equal(travel.speechLocale('Ačiū'), 'lt-LT');
});

test('mixed speech follows the dominant script and falls back to Lithuanian on ties', () => {
  assert.equal(travel.speechLocale('Siūlau aplankyti Rodo salą (Ρόδος). Kelionės laiką patikrinkite iš anksto.'), 'lt-LT');
  assert.equal(travel.speechLocale('Aplankykite Rodo sala (Ρόδος) ir patikrinkite keliones laika.'), 'lt-LT');
  assert.equal(travel.speechLocale('Καλημέρα, θα θέλαμε ένα τραπέζι για έξι άτομα. Ačiū!'), 'el-GR');
  assert.equal(travel.speechLocale('α a'), 'lt-LT');
  assert.equal(travel.speechLocale('123 — !'), 'lt-LT');
  assert.equal(travel.speechLocale(''), 'lt-LT');
});

test('show-to-person labels use modern Greek and contain no Italian remnants', () => {
  const source = readFileSync('src/components/UI.tsx', 'utf8');
  assert.match(source, /Vertimas · Μετάφραση/);
  assert.match(source, /Klausomės atsakymo · Μπορείτε να απαντήσετε/);
  assert.doesNotMatch(source, /Traduzione|Può rispondere/);
});

test('all advice, photo, explanation and recap prompts carry Rhodes context without inventing facts', () => {
  for (const prompt of [ASSISTANT_PROMPT, PHOTO_PROMPT, EXPLAIN_PROMPT, RECAP_PROMPT]) {
    assert.match(prompt, /Rodo sala.*Ρόδος/);
    assert.doesNotMatch(prompt, /[Ii]tal|coperto/);
  }
  assert.match(ASSISTANT_PROMPT, /šiuolaikin/);
  assert.match(ASSISTANT_PROMPT, /patikrink internetu/);
  assert.match(ASSISTANT_PROMPT, /Neapsimesk žinantis žmogaus buvimo vietą/);
  assert.match(PHOTO_PROMPT, /Nespėliok neįskaitomų/);
  assert.match(RECAP_PROMPT, /Nepridėk.*numatyto/);
  assert.match(EXPLAIN_PROMPT, /graikišku vertimu/);
  assert.match(speechPayload('Καλημέρα', {}).instructions, /Modern Greek/);
  assert.match(speechPayload('Laba diena', {}).instructions, /Lithuanian/);
});

// Contract tests inspect real payloads; no provider calls or asserted AI quality.
test('live interpretation defaults to modern Greek in Rhodes and preserves incoming English/Spanish', () => {
  assert.match(INTERPRETER_PROMPT, /Rodo sala.*Ρόδος/);
  assert.match(INTERPRETER_PROMPT, /šiuolaikin/);
  assert.match(INTERPRETER_PROMPT, /Lietuvių kalbą versk į graikų; graikų, anglų ir ispanų — į lietuvių/);
  assert.doesNotMatch(INTERPRETER_PROMPT, /[Ii]tal/);
  assert.deepEqual(DEFAULT_LIVE_PREFERENCES, { direction: 'auto', slow: false });
  const base = sessionSchema.parse({ sdp: 'v=0\r\nsynthetic-offer-for-test' });
  assert.match(livePayload(base, {}).session.instructions, /lietuvių į graikų; graikų, anglų ir ispanų į lietuvių/);
  for (const direction of ['toGreek', 'toLithuanian'] as const) {
    const input = sessionSchema.parse({ ...base, preferences: { direction, slow: true } });
    const target = direction === 'toGreek' ? /tik į graikų kalbą/ : /tik į lietuvių kalbą/;
    assert.match(livePayload(input, {}).session.instructions, target);
    assert.match(livePreferenceInstructions(input.preferences), target);
    assert.match(livePreferenceInstructions(input.preferences), /Kalbėk lėčiau/);
  }
  assert.equal(sessionSchema.safeParse({ ...base, preferences: { direction: 'toItalian', slow: false } }).success, false);
});
