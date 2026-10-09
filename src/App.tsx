import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowLeft, Camera, Check, CircleHelp, Download, Heart, LoaderCircle, MessageCircle, Mic, Smartphone, Square, Volume2, WifiOff, X } from 'lucide-react';
import type { ChatResult, ConversationNote, LivePreferences, SavedTrip, Screen } from '../shared/types';
import { DEFAULT_LIVE_PREFERENCES } from '../shared/live';
import { emptyTrip, readTrip, writeTrip } from './lib/storage';
import { LiveConversation, type LiveStatus } from './lib/live';
import type { ListeningStopReason, ListeningWarning } from './lib/listeningGuard';
import { conversationFragments, groupTranscripts } from './lib/transcripts';
import { request } from './lib/api';
import { prepareImage } from './lib/image';
import { useChat } from './hooks/useChat';
import { useSpeech } from './hooks/useSpeech';
import { useNetwork } from './hooks/useNetwork';
import { LogoMark } from './components/Illustrations';
import { Home } from './components/Home';
import { AssistantScreen, ListeningWarningDialog, LiveScreen, PhotoScreen } from './components/Screens';
import { Captions, Modal, Notice, ShowTranslation } from './components/UI';
import { ConversationNoteDialog } from './components/ConversationNote';
import { startBrowserNotifications } from './lib/notifications';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const route = (): Screen => ['live', 'photo', 'assistant'].includes(location.hash.slice(1)) ? location.hash.slice(1) as Screen : 'home';

export default function App() {
  useEffect(startBrowserNotifications, []);
  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [storageError, setStorageError] = useState(false);
  const latest = useRef(trip);
  latest.current = trip;
  useEffect(() => { void readTrip().then(setTrip).catch(() => { setTrip(emptyTrip()); setStorageError(true); }); }, []);
  useEffect(() => {
    if (!trip) return;
    const timer = setTimeout(() => void writeTrip(trip).catch(() => setStorageError(true)), 200);
    return () => clearTimeout(timer);
  }, [trip]);
  useEffect(() => {
    const flush = () => { if (latest.current) void writeTrip(latest.current).catch(() => {}); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);
  if (!trip) return <main className="app-loading" aria-label="Atveriame vertėją"><LogoMark /><LoaderCircle size={24} className="spin" /><p>Tuoj leisimės į kelionę…</p></main>;
  return <TripApp trip={trip} setTrip={setTrip as Dispatch<SetStateAction<SavedTrip>>} storageError={storageError} />;
}

function TripApp({ trip, setTrip, storageError }: { trip: SavedTrip; setTrip: Dispatch<SetStateAction<SavedTrip>>; storageError: boolean }) {
  const [screen, setScreen] = useState<Screen>(route);
  const online = useNetwork();
  const [help, setHelp] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [liveError, setLiveError] = useState('');
  const [listeningWarning, setListeningWarning] = useState<ListeningWarning | null>(null);
  const [stopReason, setStopReason] = useState<ListeningStopReason | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [changingPreferences, setChangingPreferences] = useState(false);
  const [archive, setArchive] = useState(false);
  const [noteRequest, setNoteRequest] = useState<{ purpose: 'recap' | 'explain'; text?: string } | null>(null);
  const [note, setNote] = useState<ConversationNote>();
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState('');
  const noteAbort = useRef<AbortController | null>(null);
  const showStarted = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [showText, setShowText] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [reset, setReset] = useState<'assistant' | 'all' | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const live = useRef<LiveConversation | null>(null);
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const speech = useSpeech();
  const fragments = useMemo(() => conversationFragments(trip.transcripts, trip.liveConversation?.id), [trip.transcripts, trip.liveConversation?.id]);
  const rows = useMemo(() => groupTranscripts(fragments), [fragments]);
  const preferences = trip.livePreferences || DEFAULT_LIVE_PREFERENCES;
  const assistant = useChat('assistant', trip.assistant, undefined, (messages) => setTrip((previous) => ({ ...previous, assistant: messages })));
  const photo = useChat('photo', trip.photo?.messages || [], trip.photo?.dataUrl, (messages) => setTrip((previous) => ({ ...previous, photo: previous.photo ? { ...previous.photo, messages } : null })), trip.photo?.name);
  const playbackPaused = speech.busy || speech.playing || speech.blocked || Boolean(noteRequest) || archive;
  const muted = paused || playbackPaused;
  const active = ['connecting', 'connected', 'reconnecting'].includes(status);

  useEffect(() => {
    const viewport = window.visualViewport;
    let blurFrame = 0;
    const update = () => {
      // Pinch zoom must enlarge the existing interface, not shrink its layout.
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      const height = viewport?.height || innerHeight;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
      // Keep the compact layout during the Send click. Expanding on blur can
      // move that button between pointerdown and pointerup and lose the click.
      const typing = document.activeElement instanceof HTMLTextAreaElement || document.documentElement.hasAttribute('data-typing');
      document.documentElement.toggleAttribute('data-typing', height < 520 && typing && (screen === 'assistant' || screen === 'photo'));
    };
    const afterBlur = () => { cancelAnimationFrame(blurFrame); blurFrame = requestAnimationFrame(update); };
    update();
    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', afterBlur);
    return () => { cancelAnimationFrame(blurFrame); window.removeEventListener('resize', update); viewport?.removeEventListener('resize', update); document.removeEventListener('focusin', update); document.removeEventListener('focusout', afterBlur); document.documentElement.style.removeProperty('--app-height'); document.documentElement.removeAttribute('data-typing'); };
  }, [screen]);

  useEffect(() => {
    const changeRoute = () => setScreen(route());
    const install = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const appInstalled = () => { setInstalled(true); setInstallEvent(null); setInstallHelp(false); };
    window.addEventListener('hashchange', changeRoute);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', appInstalled);
    return () => {
      window.removeEventListener('hashchange', changeRoute); window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', appInstalled);
    };
  }, []);
  useEffect(() => {
    const conversation = new LiveConversation(audio.current!, {
      status: setStatus, error: setLiveError, blocked: setBlocked, level: setLevel, speaking: setSpeaking,
      warning: setListeningWarning, stopped: setStopReason,
      history: () => tripRef.current.transcripts,
      fragment: (fragment) => setTrip(previous => {
        if (previous.transcripts.some(f => f.id === fragment.id)) return previous;
        const full = [...previous.transcripts, fragment];
        const truncated = full.length > 800 && full.slice(0, -800).some(f => f.conversationId === previous.liveConversation?.id);
        return { ...previous, transcripts: full.slice(-800), liveConversation: truncated && previous.liveConversation ? { ...previous.liveConversation, truncated: true } : previous.liveConversation };
      }),
    });
    live.current = conversation;
    return () => conversation.dispose();
  }, [setTrip]);
  useEffect(() => { live.current?.setAudioState(muted, playbackPaused); }, [muted, playbackPaused]);
  useEffect(() => () => noteAbort.current?.abort(), []);
  useEffect(() => {
    if (!stopReason) return;
    setShowText(null);
    speech.stop();
  }, [stopReason]);
  useEffect(() => {
    if (screen !== 'live') { live.current?.end(); setShowText(null); setArchive(false); noteAbort.current?.abort(); setNoteRequest(null); }
    speech.stop();
    window.scrollTo(0, 0);
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, [screen]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try { const result = await navigator.wakeLock.request('screen'); if (cancelled) await result.release(); else lock = result; } catch { /* Optional on devices using battery saver. */ }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => { cancelled = true; void lock?.release(); document.removeEventListener('visibilitychange', acquire); };
  }, [active]);

  function navigate(next: Screen) { if (next === screen) return; location.hash = next === 'home' ? '' : next; setScreen(next); }
  function startLive(fresh = false) {
    if (active) return;
    const conversation = !fresh && tripRef.current.liveConversation || { id: crypto.randomUUID(), startedAt: Date.now() };
    const resume = !fresh && Boolean(tripRef.current.liveConversation);
    const nextPreferences = fresh ? { ...preferences, direction: 'auto' as const } : preferences;
    const updated = { ...tripRef.current, livePreferences: nextPreferences, liveConversation: conversation, liveConversations: [...(tripRef.current.liveConversations || []).filter(item => item.id !== conversation.id), conversation].slice(-50) };
    // Set the ref before opening WebRTC; React may not have rendered yet.
    tripRef.current = updated;
    setTrip(updated);
    navigate('live'); setElapsed(0); setPaused(false); setShowText(null); speech.stop();
    void live.current?.start(conversation.id, nextPreferences, resume);
  }
  function endLive() { speech.stop(); live.current?.end(); }
  async function changePreferences(next: LivePreferences) {
    if (changingPreferences) return;
    if (active) {
      setChangingPreferences(true);
      const accepted = await live.current?.updatePreferences(next);
      setChangingPreferences(false);
      if (!accepted) { setLiveError('Nustatymo nepavyko patvirtinti. Pabandykite dar kartą, kai prisijungsime.'); return; }
    }
    setLiveError('');
    setTrip(previous => ({ ...previous, livePreferences: next }));
  }
  async function openNote(purpose: 'recap' | 'explain', text?: string) {
    const conversationId = tripRef.current.liveConversation?.id;
    if (!conversationId) return;
    speech.stop(); setNoteRequest({ purpose, text }); setNote(undefined); setNoteError('');
    noteAbort.current?.abort();
    const snapshot = conversationFragments(tripRef.current.transcripts, conversationId);
    const cached = tripRef.current.liveNote;
    if (purpose === 'recap' && cached?.purpose === purpose && cached.conversationId === conversationId && cached.fragmentCount === snapshot.length && cached.snapshotId === snapshot.at(-1)?.id) { setNote(cached); setNoteBusy(false); return; }
    const all = groupTranscripts(snapshot).filter(row => row.text.trim());
    const transcript: { id: string; role: 'user' | 'assistant'; text: string }[] = [];
    let length = 0;
    for (const row of [...all].reverse()) {
      const value = row.text.slice(-6000);
      if (transcript.length >= 100 || length + value.length > 35_000) break;
      transcript.unshift({ id: row.id, role: row.role, text: value }); length += value.length;
    }
    const partial = Boolean(tripRef.current.liveConversation?.truncated) || transcript.length < all.length || all.some(row => row.text.length > 6000);
    const controller = new AbortController(); noteAbort.current = controller; setNoteBusy(true);
    try {
      const response = await request('/api/chat', { requestId: crypto.randomUUID(), conversationId, mode: 'assistant', purpose, transcript, messages: [{ role: 'user', text: purpose === 'recap' ? 'Užrašyk svarbiausias pokalbio detales ir ką dar reikia patikslinti.' : `Paaiškink šią pasirinktą frazę pokalbio kontekste: ${text?.slice(0, 6000) || ''}` }] }, controller.signal);
      const result: ConversationNote = { ...await response.json() as ChatResult, purpose, conversationId, fragmentCount: snapshot.length, snapshotId: snapshot.at(-1)?.id || '', partial };
      if (controller.signal.aborted) return;
      setNote(result);
      if (purpose === 'recap') setTrip(previous => previous.liveConversation?.id === conversationId ? { ...previous, liveNote: result, liveNotes: [...(previous.liveNotes || []).filter(item => item.conversationId !== conversationId), result].slice(-30) } : previous);
    } catch (cause) { if (!controller.signal.aborted) setNoteError(cause instanceof Error ? cause.message : 'Nepavyko paruošti užrašo.'); }
    finally { if (noteAbort.current === controller) setNoteBusy(false); }
  }
  function closeNote() { noteAbort.current?.abort(); speech.stop(); setNoteRequest(null); }
  function conversationDate(id: string) {
    const started = trip.liveConversations?.find(item => item.id === id)?.startedAt || (trip.liveConversation?.id === id ? trip.liveConversation.startedAt : undefined);
    return started ? new Date(started).toLocaleString('lt-LT', { dateStyle: 'medium', timeStyle: 'short' }) : 'Ankstesnis pokalbis';
  }
  function draft(mode: 'photo' | 'assistant', value: string) { setTrip((previous) => ({ ...previous, drafts: { ...previous.drafts, [mode]: value } })); }
  async function selectPhoto(file: File) {
    if (selecting) return;
    setSelecting(true); setPhotoError('');
    try {
      const dataUrl = await prepareImage(file);
      photo.cancel();
      setTrip((previous) => ({ ...previous, photo: { dataUrl, name: file.name, messages: [] }, drafts: { ...previous.drafts, photo: '' } }));
      photo.send('Išverskite ir paprastai paaiškinkite šią nuotrauką.', dataUrl, file.name);
    } catch (error) { setPhotoError(error instanceof Error ? error.message : 'Nepavyko atverti nuotraukos.'); }
    finally { setSelecting(false); }
  }
  async function install() {
    if (!installEvent) { setInstallHelp(true); return; }
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }
  function confirmReset() {
    if (reset === 'all') { endLive(); assistant.cancel(); photo.cancel(); setTrip(emptyTrip()); setHelp(false); navigate('home'); }
    else { assistant.cancel(); setTrip((previous) => ({ ...previous, assistant: [], drafts: { ...previous.drafts, assistant: '' } })); }
    setReset(null);
  }

  return <div className="app-shell" data-screen={screen}><a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); const main = document.getElementById('main-content'); if (main) { main.tabIndex = -1; main.focus(); main.scrollIntoView({ block: 'start' }); } }}>Pereiti prie turinio</a><header className="site-header">{screen !== 'home' && <button className="mobile-home-button" onClick={() => navigate('home')}><ArrowLeft size={22} aria-hidden="true" />Į pradžią</button>}<button className="brand" onClick={() => navigate('home')} aria-label="Kelionės vertėjas – pradžia"><LogoMark /><span>Kelionės vertėjas<small>GRAIKIJA ARČIAU</small></span></button><div className="header-right"><span className={`network-status ${online ? '' : 'is-offline'}`}><span className="mini-dot" />{online ? 'Geros kelionės!' : 'Nėra ryšio'}</span><button className="help-button" aria-label="Kaip naudotis?" onClick={() => setHelp(true)}><CircleHelp size={21} aria-hidden="true" /><span className="desktop-help-label">Kaip naudotis?</span><span className="mobile-help-label">Pagalba</span></button></div></header>
    <audio ref={audio} autoPlay playsInline className="live-audio" aria-hidden="true" />
    {!online && <div className="offline-banner" role="status"><WifiOff size={23} /><span>Nėra interneto. Išsaugotą tekstą galite skaityti, o prisijungę – tęsti.</span></div>}
    {storageError && <div className="storage-notice"><Notice>Ši naršyklė negali išsaugoti pokalbio. Neužverkite šio lango, kol norite tęsti.</Notice></div>}
    {screen === 'home' && <Home navigate={navigate} startLive={() => startLive(true)} history={trip.transcripts.length || trip.liveNotes?.length ? () => setArchive(true) : undefined} />}
    {screen === 'live' && <LiveScreen key={trip.liveConversation?.id || 'empty'} status={status} error={liveError} stopReason={stopReason} level={level} speaking={speaking} rows={rows} muted={muted} paused={paused} blocked={blocked} elapsed={elapsed} preferences={preferences} changingPreferences={changingPreferences} onPreferences={next => void changePreferences(next)} onPause={() => { live.current?.record(paused ? 'listen' : 'pause'); setPaused(value => !value); }} onBack={() => navigate('home')} start={() => startLive()} fresh={() => startLive(true)} end={endLive} play={() => void live.current?.play()} speak={(text, slow) => { live.current?.record(slow ? 'replay_slow' : 'replay'); void speech.speak(text, slow); }} show={text => { live.current?.record('show'); showStarted.current = fragments.length; setShowText(text); }} note={(purpose, text) => void openNote(purpose, text)} archive={() => setArchive(true)} />}
    {screen === 'photo' && <PhotoScreen photo={trip.photo} chat={photo} selecting={selecting} error={photoError} draft={trip.drafts.photo} setDraft={(value) => draft('photo', value)} onBack={() => navigate('home')} onPhoto={(file) => void selectPhoto(file)} speak={(text) => void speech.speak(text)} />}
    {screen === 'assistant' && <AssistantScreen messages={trip.assistant} chat={assistant} draft={trip.drafts.assistant} setDraft={(value) => draft('assistant', value)} onBack={() => navigate('home')} speak={(text) => void speech.speak(text)} clear={() => setReset('assistant')} />}
    <footer className="site-footer"><span><Heart size={16} /> Sukurta ramesnėms kelionėms.</span>{!installed ? <button onClick={() => void install()}><Smartphone size={18} /> Įsidėti į telefoną <span aria-hidden="true">↗</span></button> : <span><Check size={18} /> Jūsų telefone</span>}</footer>
    {(speech.busy || speech.playing || speech.blocked || speech.error) && !showText && <div className="speech-toast" role="status">{speech.error ? <span>{speech.error}</span> : <><Volume2 size={22} /><span>{speech.busy ? 'Ruošiame garsą…' : speech.blocked ? 'Garsas paruoštas' : 'Skaitome balsu…'}</span></>}{speech.blocked && <button className="text-button" onClick={() => void speech.resume()}>Paleisti garsą</button>}<button className="icon-button" aria-label="Uždaryti garso grotuvą" onClick={speech.stop}>{speech.playing ? <Square size={18} fill="currentColor" /> : <X size={21} />}</button></div>}
    {showText && <ShowTranslation text={showText} onClose={() => { speech.stop(); setShowText(null); }} onSpeak={text => void speech.speak(text)} audioBusy={speech.busy} audioBlocked={speech.blocked} audioError={speech.error} resume={() => void speech.resume()} active={active} listening={status === 'connected' && !muted && !blocked} onListen={() => { speech.stop(); setPaused(false); if (blocked) void live.current?.play(); }} reply={groupTranscripts(fragments.slice(showStarted.current)).filter(row => row.role === 'assistant').at(-1)?.text} end={() => { endLive(); setShowText(null); }} />}
    {noteRequest && <ConversationNoteDialog purpose={noteRequest.purpose} note={note} busy={noteBusy} error={noteError} retry={() => void openNote(noteRequest.purpose, noteRequest.text)} speak={text => void speech.speak(text)} onClose={closeNote} audioBusy={speech.busy} audioPlaying={speech.playing} audioBlocked={speech.blocked} audioError={speech.error} stopAudio={speech.stop} resumeAudio={() => void speech.resume()} />}
    {archive && <Modal title="Ankstesni pokalbiai" onClose={() => setArchive(false)} className="archive-modal"><p>Šie užrašai išsaugoti telefone. Naujas vertimas jų nepaveldi.</p>{[...(trip.liveNotes || [])].reverse().map(saved => <button key={saved.conversationId} className="button secondary full-width saved-note" onClick={() => { setArchive(false); setNoteRequest({ purpose: 'recap' }); setNote(saved); setNoteBusy(false); setNoteError(''); }}>Pokalbio užrašas · {conversationDate(saved.conversationId)}</button>)}{[...new Set(trip.transcripts.map(fragment => fragment.conversationId || 'legacy'))].reverse().map(id => <details className="archived-conversation" key={id}><summary>{id === 'legacy' ? 'Ankstesni užrašai' : conversationDate(id)}</summary><Captions rows={groupTranscripts(trip.transcripts.filter(fragment => (fragment.conversationId || 'legacy') === id))} /></details>)}{!trip.transcripts.length && !trip.liveNotes?.length && <p>Kol kas išsaugotų pokalbių nėra.</p>}<button className="button primary full-width" onClick={() => setArchive(false)}>Grįžti</button></Modal>}
    {help && <Modal title="Kaip naudotis?" className="help-modal" onClose={() => setHelp(false)} footer={<button className="button primary full-width" onClick={() => setHelp(false)}><Check size={22} /> Supratau</button>}>
      <div className="help-step"><span className="help-step-icon terracotta"><Mic size={25} aria-hidden="true" /></span><div><h3>Versti pokalbį</h3><p>Kalbėkite tiesiai pašnekovui. Jūsų žodžius versime graikiškai, atsakymą – lietuviškai. Palietę vertimą galėsite jį pakartoti ar parodyti.</p></div></div>
      <div className="help-step"><span className="help-step-icon sand"><Camera size={25} aria-hidden="true" /></span><div><h3>Išversti nuotrauką</h3><p>Nufotografuokite meniu, ženklą ar bilietą. Galite įkelti ir turimą nuotrauką.</p></div></div>
      <div className="help-step"><span className="help-step-icon sage"><MessageCircle size={25} aria-hidden="true" /></span><div><h3>Paklausti patarimo</h3><p>Parašykite arba pasakykite klausimą apie kelionę.</p></div></div>
      <details className="help-detail"><summary>Ryšys ir privatumas</summary><p>Naujiems vertimams reikia interneto. Pokalbio tekstas ir paskutinė nuotrauka išsaugomi šiame telefone.</p><p>Vertimui garsas, nuotraukos ir klausimai siunčiami „OpenAI“. Garso įrašų mūsų serveris nesaugo. Kai įjungta kelionės istorija, organizatorius gali matyti išsiųstas nuotraukas, klausimus, diktuotą tekstą, atsakymus ir balso pokalbių tekstus. Pranešimai apie veiklą gali būti siunčiami organizatoriui per „ntfy“. Naršyklės žymėjimas leidžia susieti tos pačios naršyklės veiksmus. Balso pokalbis baigiamas išėjus iš jo ekrano.</p><button className="clear-data" onClick={() => setReset('all')}>Ištrinti šiame telefone išsaugotą pokalbį ir nuotrauką</button></details>
    </Modal>}
    {installHelp && <Modal title="Vertėjas – visada po ranka." onClose={() => setInstallHelp(false)}><div className="install-symbol"><Download size={35} /></div><p className="modal-lead">Įsidėkite į telefono pradžios ekraną. Kitą kartą užteks paliesti piktogramą.</p><div className="install-instructions"><h3>„iPhone“ su „Safari“</h3><p>Paspauskite „Bendrinti“ <span aria-hidden="true">↑</span>, tada „Pridėti prie pradžios ekrano“ ir „Pridėti“.</p><h3>„Android“ su „Chrome“</h3><p>Atverkite naršyklės meniu <span aria-hidden="true">⋮</span> ir pasirinkite „Pridėti prie pagrindinio ekrano“ arba „Įdiegti programą“.</p></div><button className="button primary full-width" onClick={() => setInstallHelp(false)}>Supratau</button></Modal>}
    {reset && <Modal title={reset === 'all' ? 'Ištrinti išsaugotą informaciją?' : 'Pradėti naują pokalbį?'} onClose={() => setReset(null)}><p className="modal-lead">{reset === 'all' ? 'Iš šio telefono bus pašalinti pokalbiai, juodraščiai ir nuotrauka.' : 'Ankstesnio pokalbio tekstas bus pašalintas. Galėsite klausti nauja tema.'}</p><div className="dialog-actions"><button className="button secondary" onClick={() => setReset(null)}>Grįžti</button><button className="button primary" onClick={confirmReset}>{reset === 'all' ? 'Ištrinti' : 'Pradėti naują'}</button></div></Modal>}
    {screen === 'live' && listeningWarning && <ListeningWarningDialog warning={listeningWarning} onContinue={() => live.current?.continueListening()} onEnd={endLive} />}
  </div>;
}
