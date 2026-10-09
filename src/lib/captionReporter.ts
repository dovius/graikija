import type { TranscriptFragment } from '../../shared/types';
import type { LiveDiagnostic } from '../../shared/live';
import { notificationActivity } from './notifications';

// The media connection bypasses our server. Send only its displayed captions,
// in small deduplicated batches, including the final batch when leaving a call.
export class CaptionReporter {
  private pending = new Map<string, Map<string, TranscriptFragment>>();
  private diagnostics = new Map<string, Map<string, LiveDiagnostic>>();
  private timer?: ReturnType<typeof setTimeout>;
  private sending = false;
  private disposed = false;
  constructor() { window.addEventListener('online', this.online); }
  private online = () => { void this.flush(); };
  add(fragment: TranscriptFragment) {
    const session = this.pending.get(fragment.session) || new Map<string, TranscriptFragment>();
    session.set(fragment.id, fragment);
    this.pending.set(fragment.session, session);
    this.schedule(4000);
  }
  record(sessionId: string, event: LiveDiagnostic) {
    const events = this.diagnostics.get(sessionId) || new Map<string, LiveDiagnostic>();
    events.set(event.id, event);
    if (events.size > 200) events.delete(events.keys().next().value!);
    this.diagnostics.set(sessionId, events);
    this.schedule(4000);
  }
  pendingCount() { return [...this.pending.values()].reduce((sum, events) => sum + events.size, 0); }
  private schedule(delay: number) {
    if (!this.timer && !this.disposed) this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, delay);
  }
  private batches() {
    const batches: { sessionId: string; fragments: TranscriptFragment[]; diagnostics?: LiveDiagnostic[] }[] = [];
    for (const [sessionId, values] of this.pending) {
      let fragments: TranscriptFragment[] = [];
      let size = 0;
      for (const fragment of values.values()) {
        const bytes = new TextEncoder().encode(JSON.stringify(fragment)).length;
        if (fragments.length && (fragments.length >= 80 || size + bytes > 45_000)) { batches.push({ sessionId, fragments }); fragments = []; size = 0; }
        fragments.push(fragment); size += bytes;
      }
      if (fragments.length) batches.push({ sessionId, fragments });
    }
    for (const [sessionId, events] of this.diagnostics) {
      const values = [...events.values()];
      for (let index = 0; index < values.length; index += 40) {
        const batch = batches.find(item => item.sessionId === sessionId && !item.diagnostics);
        if (batch) batch.diagnostics = values.slice(index, index + 40);
        else batches.push({ sessionId, fragments: [], diagnostics: values.slice(index, index + 40) });
      }
    }
    return batches;
  }
  async flush(leaving = false) {
    clearTimeout(this.timer); this.timer = undefined;
    if (leaving && navigator.sendBeacon) {
      // Beacon delivery is best effort; server IDs also deduplicate an in-flight
      // normal upload. Keep entries until an acknowledged upload succeeds.
      for (const batch of this.batches()) {
        const body = JSON.stringify(batch);
        if (!navigator.sendBeacon('/api/live/fragments', new Blob([body], { type: 'application/json' }))) {
          void fetch('/api/live/fragments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
        }
      }
      return;
    }
    if (this.sending) return;
    this.sending = true;
    try {
      for (const batch of this.batches()) {
        const response = await fetch('/api/live/fragments', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch), keepalive: true, signal: AbortSignal.timeout(10_000) });
        notificationActivity(response);
        if (!response.ok && response.status !== 403) throw new Error('Caption upload failed');
        const session = this.pending.get(batch.sessionId);
        for (const fragment of batch.fragments) session?.delete(fragment.id);
        if (!session?.size) this.pending.delete(batch.sessionId);
        const events = this.diagnostics.get(batch.sessionId);
        for (const event of batch.diagnostics || []) events?.delete(event.id);
        if (!events?.size) this.diagnostics.delete(batch.sessionId);
      }
    } catch { /* Retry without interrupting speech or displaying a second error. */ }
    finally { this.sending = false; if (this.pending.size || this.diagnostics.size) this.schedule(10_000); }
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    window.removeEventListener('online', this.online);
    void this.flush(true);
  }
}
