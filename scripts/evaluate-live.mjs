// Explicit, small paid smoke test. Never runs as part of npm test.
// node --import tsx scripts/evaluate-live.mjs
// Uses only synthetic utterances, not private trip history. No provider storage.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'dotenv';
import WebSocket from 'ws';
import { chatSchema, sessionSchema } from '../server/validation.ts';
import { chatPayload, livePayload, speechPayload } from '../server/payloads.ts';
import { extractResponse } from '../server/response.ts';
import { validateConversationAnswer } from '../server/recap.ts';
import { LIVE_PROMPT_VERSION, livePreferenceInstructions } from '../shared/live.ts';

const env = { ...parse(await readFile('.dev.vars', 'utf8')), ...process.env };
if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
const destination = `data/analysis/live-eval-${new Date().toISOString().replaceAll(':', '-')}`;
await mkdir(destination, { recursive: true });
const report = { promptVersion: LIVE_PROMPT_VERSION, createdAt: new Date().toISOString(), synthetic: true, notes: [], conversations: [] };
const save = () => writeFile(`${destination}/results.json`, JSON.stringify(report, null, 2));
const post = async (endpoint, body) => {
  const response = await fetch(`https://api.openai.com/v1/${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(`${endpoint}: HTTP ${response.status}, ${data.error?.code || data.error?.type || 'unknown'}: ${String(data.error?.message || '').slice(0, 500)}`); }
  return response;
};

// Contradictory / partial numbers and a model-invented booking confirmation.
const transcript = [
  { id: 'one', role: 'user', text: 'Θα θέλαμε να πάμε στη Λίνδο αύριο. Είμαστε έξι.' },
  { id: 'two', role: 'user', text: 'Η αναχώρηση είναι στις δεκαπέντε και τριάντα. Η επιστροφή στις δεκαεπτά και τριάντα.' },
  { id: 'three', role: 'user', text: 'Η τιμή είναι δεκαπέντε… όχι, είκοσι ευρώ το άτομο.' },
  { id: 'translation', role: 'assistant', text: 'Rezervacija patvirtinta aštuoniems žmonėms šiandien.' },
];
for (const purpose of (process.argv.includes('--audio-only') ? [] : ['recap', 'explain'])) {
  const input = chatSchema.parse({ requestId: crypto.randomUUID(), mode: 'assistant', purpose, transcript, messages: [{ role: 'user', text: purpose === 'recap' ? 'Ką sutarėme?' : 'Paaiškink, ar jau turime rezervaciją.' }] });
  const result = validateConversationAnswer(extractResponse(await (await post('responses', chatPayload(input, env))).json()), input);
  report.notes.push({ purpose, ...result }); await save(); console.log(`${purpose}: returned and validated`);
}

function wav(pcm) {
  const header = Buffer.alloc(44); header.write('RIFF'); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40); return Buffer.concat([header, pcm]);
}
const scenarios = [
  { name: 'lt_numbers', language: 'Lithuanian', text: 'Norėtume staliuko šešiems žmonėms rytoj penkioliktą trisdešimt.' },
  { name: 'el_numbers', language: 'Modern Greek', text: 'Η επιστροφή είναι στις δεκαεπτά και τριάντα. Η τιμή είναι δεκαπέντε ευρώ το άτομο.' },
  { name: 'correction', language: 'Lithuanian', text: 'Ne aštuoni, o šeši žmonės. Ne penkioliktą, o penkioliktą trisdešimt.' },
  { name: 'direct_question', language: 'Lithuanian', text: 'Paklausk, ar galime važiuoti šešiese. Ir ar rytoj bus vietos?', steer: true },
];
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
const reuse = process.argv.find(arg => arg.startsWith('--reuse='))?.slice(8);
for (const scenario of scenarios.filter(item => !only || only.includes(item.name))) {
  const speech = { ...speechPayload(scenario.text, env), response_format: 'pcm', instructions: `Read exactly in ${scenario.language}, clearly at a natural, unhurried pace. Add nothing.` };
  const pcm = reuse ? (await readFile(`${reuse}/${scenario.name}-input.wav`)).subarray(44) : Buffer.from(await (await post('audio/speech', speech)).arrayBuffer());
  if (pcm.length > 25 * 48000) throw new Error('Synthetic audio exceeded 25-second bound');
  await writeFile(`${destination}/${scenario.name}-input.wav`, wav(pcm));
  const entry = { name: scenario.name, input: scenario.text, inputSeconds: pcm.length / 48000, heard: '', translated: '', audioBytes: 0, unsolicitedBeforeInput: '', events: [], closed: false };
  report.conversations.push(entry);
  const socket = new WebSocket('wss://api.openai.com/v1/live/sessions', { headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, handshakeTimeout: 15000 });
  const audio = []; let started = false, inputSent = false, failure;
  const eventTimes = new Map();
  const beginning = Date.now();
  socket.on('message', data => {
    let event; try { event = JSON.parse(data.toString()); } catch { return; }
    eventTimes.set(event.type, event);
    if (event.type === 'session.started') { started = true; entry.sessionId = event.session?.id; }
    else if (event.type === 'session.input_transcript.delta') entry.heard += event.delta;
    else if (event.type === 'session.output_transcript.delta') { entry.translated += event.delta; if (!inputSent) entry.unsolicitedBeforeInput += event.delta; }
    else if (event.type === 'session.output_audio.delta') { const bytes = Buffer.from(event.delta, 'base64'); audio.push(bytes); entry.audioBytes += bytes.length; }
    else if (event.type === 'session.closed') { entry.closed = true; entry.usage = event.usage; }
    else if (event.type === 'error') { failure = new Error(`Live error: ${event.error?.code || 'unknown'} ${event.error?.message || ''}`); }
    if (!event.type.endsWith('.delta')) entry.events.push({ type: event.type, ms: Date.now() - beginning, client_event_id: event.client_event_id });
  });
  socket.on('error', error => { failure = new Error(`WebSocket: ${error.message}`); });
  const wait = async (predicate, milliseconds) => { const until = Date.now() + milliseconds; while (!predicate()) { if (failure) throw failure; if (Date.now() > until) throw new Error('Live event timeout'); await delay(30); } };
  const send = value => socket.send(JSON.stringify(value));
  const pump = async bytes => { for (let offset = 0; offset < bytes.length; offset += 4800) { if (failure) throw failure; send({ type: 'session.input_audio.append', audio: bytes.subarray(offset, offset + 4800).toString('base64') }); await delay(100); } };
  const close = async () => { if (socket.readyState === WebSocket.OPEN && started && !entry.closed) { send({ type: 'session.close', event_id: crypto.randomUUID() }); await wait(() => entry.closed, 8000).catch(() => {}); } socket.terminate(); };
  // Bound even an unexpected failure. Also use the HTTP hangup if final close is lost.
  const hardStop = setTimeout(() => socket.terminate(), 70000);
  try {
    await wait(() => socket.readyState === WebSocket.OPEN, 16000);
    const startup = livePayload(sessionSchema.parse({ sdp: 'v=0\r\nsynthetic-evaluation', startReason: 'new' }), env).session;
    send({ type: 'session.start', event_id: crypto.randomUUID(), session: { ...startup, audio: { ...startup.audio, format: { type: 'audio/pcm', rate: 24000 } } } });
    await wait(() => started, 15000);
    await pump(Buffer.alloc(2 * 48000));
    if (scenario.steer) {
      const id = crypto.randomUUID(); send({ type: 'session.instructions.append', event_id: id, delegation_id: null, content: livePreferenceInstructions({ direction: 'toGreek', slow: true }) });
      // Injection progress requires a continuous audio stream, including silence.
      await pump(Buffer.alloc(3 * 48000));
      entry.steeringAcknowledged = eventTimes.get('session.instructions.appended')?.client_event_id === id;
    }
    inputSent = true;
    await pump(pcm);
    await pump(Buffer.alloc(12 * 48000));
  } catch (error) { entry.error = String(error.message).slice(0, 600); }
  finally {
    await close(); clearTimeout(hardStop);
    if (!entry.closed && entry.sessionId) {
      try {
        const response = await fetch(`https://api.openai.com/v1/live/sessions/${entry.sessionId}/hangup`, { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(15000) });
        const data = await response.json().catch(() => ({}));
        entry.hangupConfirmed = response.ok || (response.status === 404 && data.error?.code === 'session_id_not_found');
      } catch { entry.hangupConfirmed = false; }
    }
    await writeFile(`${destination}/${scenario.name}-output.wav`, wav(Buffer.concat(audio))); await save();
  }
  if (!entry.error && (!entry.closed || !entry.translated.trim() || !entry.audioBytes)) entry.error = 'Missing translation, audio, or close acknowledgement';
  await save();
  console.log(`${scenario.name}: ${entry.error || entry.translated || '(no translation)'}`);
  if (entry.error) { process.exitCode = 1; break; }
}
console.log(`Saved synthetic evaluation: ${destination}`);
