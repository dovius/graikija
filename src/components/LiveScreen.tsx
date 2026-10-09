import { useEffect, useState, type CSSProperties } from 'react';
import { CircleCheck, Eye, History, LoaderCircle, MessageCircle, Mic, MicOff, MoreHorizontal, Pause, PhoneOff, Plus, Volume2 } from 'lucide-react';
import type { LivePreferences, TranscriptRow } from '../../shared/types';
import type { LiveStatus } from '../lib/live';
import type { ListeningStopReason } from '../lib/listeningGuard';
import { Captions, Modal, Notice, ScreenHeader } from './UI';

export function LiveScreen({ status, error, stopReason, level, speaking, rows, muted, paused, blocked, elapsed, preferences, changingPreferences, onPreferences, onPause, onBack, start, fresh, end, play, speak, show, note, archive }: {
  status: LiveStatus; error: string; stopReason: ListeningStopReason | null; level: number; speaking: boolean; rows: TranscriptRow[]; muted: boolean; paused: boolean; blocked: boolean; elapsed: number;
  preferences: LivePreferences; changingPreferences: boolean; onPreferences: (preferences: LivePreferences) => void; onPause: () => void;
  onBack: () => void; start: () => void; fresh: () => void; end: () => void; play: () => void; speak: (text: string, slow?: boolean) => void; show: (text: string) => void;
  note: (purpose: 'recap' | 'explain', text?: string) => void; archive: () => void;
}) {
  const [selected, setSelected] = useState<TranscriptRow | null>(null);
  const [options, setOptions] = useState(false);
  // A selection is an immutable snapshot, even if late captions revise a row.
  useEffect(() => { setSelected(null); }, [rows[0]?.session]);
  const active = ['connecting', 'connected', 'reconnecting'].includes(status);
  const listening = status === 'connected' && !muted && !blocked;
  const last = [...rows].reverse().find(row => row.role === 'assistant' && row.text.trim());
  const chosen = selected || last;
  const clock = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const stoppedHint = stopReason === 'silence' ? '2 minutes negavome naujos išgirstos kalbos.' : stopReason === 'duration' ? 'Praėjo 10 minučių. Galite tęsti pokalbį.' : 'Išėjus iš vertėjo, pokalbis sustabdomas.';
  const stateText = status === 'connecting' ? 'Jungiamės…' : status === 'reconnecting' ? 'Atkuriame ryšį…' : status === 'connected' && blocked ? 'Įjunkite garsą' : muted && active ? 'Mikrofonas pristabdytas' : status === 'connected' ? 'Galite kalbėti' : status === 'ended' ? stopReason ? 'Mikrofonas išjungtas' : 'Ačiū už pokalbį.' : status === 'error' ? 'Nepavyko prisijungti.' : 'Pasiruošę kalbėtis?';
  const stateHint = status === 'connecting' ? 'Jei telefonas paprašys mikrofono, pasirinkite „Leisti“.' : status === 'reconnecting' ? 'Palaukite. Pokalbis tęsis, kai grįš ryšys.' : blocked && active ? 'Įjunkite garsą. Tada vėl klausysimės jūsų.' : paused && active ? 'Norėdami kalbėti, spauskite „Klausytis toliau“.' : muted && active ? 'Kol kartojamas vertimas, mikrofonas pristabdytas.' : status === 'connected' ? 'Kalbėkite po vieną. Telefoną laikykite tarp jūsų.' : status === 'ended' ? stopReason ? stoppedHint : 'Galite tęsti šį pokalbį arba pradėti naują.' : 'Paspauskite „Pradėti pokalbį“.';
  const connectionText = status === 'connected' ? 'Prisijungta' : status === 'connecting' ? 'Ruošiame vertėją' : status === 'reconnecting' ? 'Ryšys nutrūko' : status === 'ended' ? 'Pokalbis baigtas' : status === 'error' ? 'Neprisijungta' : 'Gyvas vertėjas';
  const directionText = preferences.direction === 'auto' ? 'Lietuvių ⇄ Graikų' : preferences.direction === 'toGreek' ? 'Lietuvių → Graikų' : 'Pašnekovas → Lietuvių';
  const snapshot = (action: (text: string) => void) => { if (chosen) { setSelected({ ...chosen }); action(chosen.text); } };
  const menuAction = (action: () => void) => { setOptions(false); action(); };

  return <main className="tool-page live-page" id="main-content" data-status={status} data-active={active} data-has-text={rows.length > 0}>
    <div className="live-heading">
      <div className="live-title"><ScreenHeader eyebrow="GYVAS VERTĖJAS" title="Versti pokalbį" description="Kalbėkite tiesiai žmogui. Mes išversime balsu." onBack={onBack} />
    <div className="live-direction"><span className="lithuanian-flag" aria-hidden="true" /><span>{directionText}{preferences.slow ? ' · Lėčiau' : ''}</span><span className="greek-flag" aria-hidden="true" /></div></div>
      <button className="button secondary live-menu-button" aria-label="Daugiau veiksmų" aria-haspopup="dialog" onClick={() => setOptions(true)}><MoreHorizontal size={22} aria-hidden="true" /><span>Daugiau</span></button>
    </div>
    {error && !options && <Notice retry={!active ? start : undefined}>{error}</Notice>}
    <section className={`live-stage ${listening ? 'is-live' : ''}`} aria-label="Pokalbio būsena">
      <div className="live-stage-heading">
        <div className="live-orb" aria-hidden="true">{status === 'connecting' || status === 'reconnecting' ? <LoaderCircle className="spin" size={34} /> : muted || blocked || status === 'ended' || status === 'error' ? <MicOff size={34} strokeWidth={1.7} /> : <Mic size={34} strokeWidth={1.7} />}</div>
        <div className="live-stage-copy">
          <div className="live-stage-top"><span className={`connection-label ${status === 'connected' ? 'connected' : ''}`}>{status === 'connected' && <CircleCheck size={18} aria-hidden="true" />}{connectionText}</span>{status === 'connected' && <span className="call-clock" aria-label={`Pokalbio trukmė ${clock}`}>{clock}</span>}</div>
          <h2 aria-live="polite">{stateText}</h2>
      {listening && <div className="live-listening"><span>{speaking ? 'Skamba vertimas' : 'Klausomės'}</span><div className="sound-wave" aria-hidden="true">{Array.from({ length: 23 }, (_, index) => <i key={index} style={{ '--bar-height': `${10 + (Math.sin(index * 0.8) * 0.5 + 0.5) * 4 + (8 + (Math.sin(index * 1.8) * 0.5 + 0.5) * 18) * level}px`, '--bar-delay': `${index * -0.11}s` } as CSSProperties} />)}</div></div>}
        </div>
        {active && <button className="button primary pause-button" onClick={onPause} aria-pressed={paused}>{paused ? <Mic size={23} aria-hidden="true" /> : <Pause size={23} aria-hidden="true" />}<span>{paused ? 'Klausytis toliau' : 'Pauzė'}</span></button>}
      </div>
      <p>{stateHint}</p>

      {!active && <button className="button primary large" onClick={start}><Mic size={24} />{status === 'ended' ? 'Tęsti pokalbį' : 'Pradėti pokalbį'}</button>}
      {!active && rows.length > 0 && <button className="button secondary new-live-button" onClick={fresh}><Plus size={22} aria-hidden="true" />Naujas pokalbis</button>}
      {blocked && active && <button className="button primary" onClick={play}><Volume2 size={23} /> Įjungti garsą</button>}
    </section>

    {rows.length > 0 ? <section className="transcript-section" data-selected={Boolean(selected)}>
      <div className="section-intro"><h2>{selected ? 'Pasirinktas vertimas' : 'Pokalbio tekstas'}</h2>{selected ? <button className="text-button" onClick={() => setSelected(null)}>Rodyti naujausią</button> : <span>Palieskite vertimą</span>}</div>
      {selected ? <div className="chosen-translation" tabIndex={0} aria-label="Pasirinktas vertimas"><p>{selected.text}</p></div> : <Captions rows={rows} onSelect={row => setSelected({ ...row })} />}
    </section> : <div className="empty-transcript"><MessageCircle size={28} aria-hidden="true" /><p>Čia matysite pokalbio tekstą ir vertimą.</p></div>}

    {(chosen || active) && <div className="live-controls" aria-label="Pokalbio valdymas">
      {chosen && <div className="translation-actions"><button className="button secondary" onClick={() => snapshot(speak)}><Volume2 size={23} aria-hidden="true" /> Pakartoti</button><button className="button secondary" onClick={() => snapshot(show)}><Eye size={23} aria-hidden="true" /> Parodyti žmogui</button></div>}
      {active && <div className="call-actions"><button className="button end-button" onClick={end}><PhoneOff size={22} aria-hidden="true" /> Baigti pokalbį</button></div>}
    </div>}

    {options && <Modal title="Pokalbio veiksmai" className="live-menu-modal" onClose={() => setOptions(false)}>
      {active && <p className="menu-mic-state">{listening ? <Mic size={21} /> : <MicOff size={21} />}{listening ? 'Mikrofonas įjungtas' : 'Mikrofonas pristabdytas'}</p>}
      {error && <Notice>{error}</Notice>}
      <div className="live-extra-actions">
        {chosen && <button className="button secondary" onClick={() => menuAction(() => snapshot(text => speak(text, true)))}><Volume2 size={23} />Pakartoti lėčiau</button>}
        {rows.some(row => row.role === 'user') && <button className="button secondary" onClick={() => menuAction(() => note('recap'))}><CircleCheck size={23} />Ką sutarėme?</button>}
        {chosen && <button className="button secondary" onClick={() => menuAction(() => snapshot(text => note('explain', text)))}><MessageCircle size={23} />Paaiškink man</button>}
        <button className="button secondary" onClick={() => menuAction(archive)}><History size={23} />Ankstesni pokalbiai</button>
      </div>
      <section className="live-options" aria-label="Vertimo nustatymai">
        <h3>Vertimo nustatymai</h3>
        <label htmlFor="translation-direction">Kas dabar kalba?</label>
        <select id="translation-direction" value={preferences.direction} disabled={changingPreferences || (active && status !== 'connected')} onChange={event => onPreferences({ ...preferences, direction: event.target.value as LivePreferences['direction'] })}>
          <option value="auto">Abi kalbos automatiškai</option><option value="toGreek">Kalbu aš → versti graikiškai</option><option value="toLithuanian">Kalba pašnekovas → versti lietuviškai</option>
        </select>
        <label className="slow-setting"><input type="checkbox" checked={preferences.slow} disabled={changingPreferences || (active && status !== 'connected')} onChange={event => onPreferences({ ...preferences, slow: event.target.checked })} /> Vertėjas kalba lėčiau</label>
        {changingPreferences && <p role="status">Siunčiame nustatymą…</p>}
        <p>Jei kalba atpažįstama neteisingai, pasirinkite kalbantį žmogų.</p>
      </section>
    </Modal>}
  </main>;
}
