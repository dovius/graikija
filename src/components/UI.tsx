import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, Check, CircleAlert, LoaderCircle, Mic, MicOff, Send, Square, Volume2, X } from 'lucide-react';
import Markdown from 'react-markdown';
import type { Message, TranscriptRow } from '../../shared/types';
import { useRecorder } from '../hooks/useRecorder';

export function Notice({ children, retry, onDismiss }: { children: ReactNode; retry?: () => void; onDismiss?: () => void }) {
  return <div className="notice" role="alert"><CircleAlert size={23} className="shrink" /><div>{children}{retry && <button className="text-button notice-retry" onClick={retry}>Pabandyti dar kartą <span aria-hidden="true">↗</span></button>}</div>{onDismiss && <button className="icon-button" aria-label="Uždaryti pranešimą" onClick={onDismiss}><X size={20} /></button>}</div>;
}
export function ScreenHeader({ eyebrow, title, description, onBack }: { eyebrow: string; title: string; description: string; onBack: () => void }) {
  return <div className="screen-heading"><button className="back-button" onClick={onBack}><ArrowLeft size={21} /> Į pradžią</button><span className="eyebrow">{eyebrow}</span><h1 tabIndex={-1}>{title}</h1><p>{description}</p></div>;
}
export function Modal({ title, children, footer, onClose, className = '', dismissible = true }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; className?: string; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (dismissible && event.target === event.currentTarget) onClose(); }}><div className="modal-inner"><div className="modal-heading"><h2>{title}</h2>{dismissible && <button className="modal-close" autoFocus onClick={onClose} aria-label="Uždaryti"><X size={22} aria-hidden="true" /><span>Uždaryti</span></button>}</div><div className="modal-content">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</div></dialog>;
}
export function ShowTranslation({ text, onClose, onSpeak, audioBusy, audioBlocked, audioError, resume, listening, active, onListen, reply, end }: { text: string; onClose: () => void; onSpeak: (text: string) => void; audioBusy: boolean; audioBlocked: boolean; audioError: string; resume: () => void; listening: boolean; active: boolean; onListen: () => void; reply?: string; end: () => void }) {
  return <Modal title="Vertimas · Μετάφραση" onClose={onClose} className="translation-modal" footer={<><div className="translation-controls"><button className="button secondary" disabled={audioBusy && !audioBlocked} onClick={() => audioBlocked ? resume() : onSpeak(text)}>{audioBusy && !audioBlocked ? <LoaderCircle className="spin" size={24} /> : <Volume2 size={24} />} {audioBlocked ? 'Paleisti garsą' : audioBusy ? 'Ruošiame…' : 'Pakartoti'}</button><button className="button primary" onClick={onClose}><Check size={24} /> Grįžti</button></div>{active && <button className="button end-button show-end" onClick={end}><MicOff size={21} />Baigti pokalbį</button>}</>}><div className="translation-display"><span className="eyebrow">PARODYKITE PAŠNEKOVUI</span><p>{text}</p></div><div className="show-listening" role="status">{listening ? <><Mic size={23} /> Klausomės atsakymo · Μπορείτε να απαντήσετε</> : <><MicOff size={23} /> {active ? 'Mikrofonas pristabdytas' : 'Mikrofonas išjungtas'}</>}</div>{active && !listening && !audioBusy && !audioBlocked && <button className="button secondary full-width" onClick={onListen}>Klausytis atsakymo</button>}{reply && <div className="show-reply"><span>Naujas vertimas</span><p>{reply}</p></div>}{audioError && <Notice>{audioError}</Notice>}</Modal>;
}
export function Composer({ draft, setDraft, onSend, disabled, photo = false }: { draft: string; setDraft: (value: string) => void; onSend: (value: string) => void; disabled: boolean; photo?: boolean }) {
  const recorder = useRecorder((text) => setDraft(draft ? `${draft} ${text}` : text));
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [dictated, setDictated] = useState(false);
  useEffect(() => {
    if (textarea.current) { textarea.current.style.height = 'auto'; textarea.current.style.height = `${Math.min(180, textarea.current.scrollHeight)}px`; }
  }, [draft]);
  useEffect(() => { if (recorder.transcribing) setDictated(true); }, [recorder.transcribing]);
  const submit = () => {
    if (!draft.trim() || disabled || recorder.recording || recorder.transcribing) return;
    onSend(draft); setDraft(''); setDictated(false);
  };
  return <div className="composer-wrap">
    {recorder.error && <Notice>{recorder.error}</Notice>}
    {recorder.recording ? <div className="recording-panel" role="status"><span className="recording-dot" /><span>Klausomės… {recorder.seconds} s</span><button className="button primary" onClick={recorder.stop}><Square size={18} fill="currentColor" /> Baigti įrašą</button></div> : <>
      {recorder.transcribing && <div className="composer-status" role="status"><LoaderCircle size={20} className="spin" /> Užrašome jūsų klausimą…</div>}
      {dictated && !recorder.transcribing && draft && <p className="composer-hint">Klausimą galite pataisyti. Tada spauskite „Siųsti“.</p>}
      <form className="composer" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label className="sr-only" htmlFor={photo ? 'photo-question' : 'assistant-question'}>{photo ? 'Klausimas apie nuotrauką' : 'Jūsų klausimas'}</label>
        <textarea ref={textarea} id={photo ? 'photo-question' : 'assistant-question'} rows={1} maxLength={4000} value={draft} disabled={disabled || recorder.transcribing} onChange={(event) => setDraft(event.target.value)} placeholder={photo ? 'Paklauskite apie šią nuotrauką…' : 'Parašykite savo klausimą…'} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.innerWidth > 700) { event.preventDefault(); submit(); } }} />
        <div className="composer-actions"><button type="button" className="dictate-button" disabled={disabled || recorder.transcribing} onClick={() => void recorder.start()}><Mic size={22} /> Kalbėti</button><button type="submit" className="send-button" disabled={!draft.trim() || disabled || recorder.transcribing}><Send size={21} /><span>Siųsti</span></button></div>
      </form>
    </>}
    <p className="composer-hint">{photo ? 'Nuotraukos nereikia siųsti iš naujo.' : 'Galite rašyti arba paspausti mikrofoną.'}</p>
  </div>;
}
export function Conversation({ messages, busy, onSpeak }: { messages: Message[]; busy: boolean; onSpeak: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastShown = useRef<string | undefined>(undefined);
  const [scrolled, setScrolled] = useState(false);
  const latest = () => {
    const el = ref.current;
    const answer = el?.querySelector<HTMLElement>('.message:last-of-type');
    if (el && answer) el.scrollTop += answer.getBoundingClientRect().top - el.getBoundingClientRect().top - 4;
    setScrolled(false);
  };
  useLayoutEffect(() => {
    const last = messages.at(-1);
    const el = ref.current;
    if (!el) return;
    // A whole answer arrives at once. Begin at its first sentence, not its footnote.
    if (last && last.id !== lastShown.current && (nearBottom.current || last.role === 'user')) {
      if (last.role === 'assistant') latest();
      else { el.scrollTop = el.scrollHeight; nearBottom.current = true; }
    } else if (busy && nearBottom.current) el.scrollTop = el.scrollHeight;
    lastShown.current = last?.id;
  }, [messages, busy]);
  return <div className="conversation-wrap"><div className="chat-messages" ref={ref} role="log" aria-label="Pokalbis" aria-live="polite" aria-relevant="additions" onScroll={() => { const el = ref.current!; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; const last = el.querySelector('.message:last-of-type'); setScrolled(Boolean(last && last.getBoundingClientRect().top > el.getBoundingClientRect().bottom - 40)); }}>
    {messages.map((message) => <article key={message.id} className={`message ${message.role}`}><div className="message-heading"><div className="message-label">{message.role === 'user' ? 'Jūs' : 'Kelionės asistentas'}</div>{message.role === 'assistant' && <button className="message-speak" onClick={() => onSpeak(message.text)}><Volume2 size={20} /> Išklausyti</button>}</div><div className="message-body"><Markdown components={{ a: (props) => <a href={props.href} target="_blank" rel="noreferrer noopener">{props.children}</a>, img: () => null }}>{message.text}</Markdown></div>{message.sources && message.sources.length > 0 && <div className="sources" aria-label="Atsakymo šaltiniai">{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener">{source.title} ↗</a>)}</div>}</article>)}
    {busy && <div className="thinking" role="status"><span className="thinking-dots"><i /><i /><i /></span> Ruošiame atsakymą…</div>}
  </div>{scrolled && <button className="latest-button" onClick={latest}><ArrowDown size={19} /> Naujausias atsakymas</button>}</div>;
}
export function Captions({ rows, onSelect, selectedId }: { rows: TranscriptRow[]; onSelect?: (row: TranscriptRow) => void; selectedId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const scrollIntentUntil = useRef(0);
  const [scrolled, setScrolled] = useState(false);
  const scrollIntent = () => { scrollIntentUntil.current = Date.now() + 1500; };
  const scrolledByUser = () => {
    // Changing the caption area's height can itself fire scroll events. Those
    // must not masquerade as a reader deliberately scrolling into history.
    if (follow.current && Date.now() > scrollIntentUntil.current) return;
    const el = ref.current!;
    follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70;
    setScrolled(!follow.current);
  };
  useLayoutEffect(() => { if (follow.current && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [rows]);
  useLayoutEffect(() => {
    const element = ref.current!;
    // Safari/Chrome bars can resize the caption area without adding a transcript row.
    // Follow the newest translation only while the reader has not scrolled into history.
    const observer = new ResizeObserver(() => { if (follow.current) element.scrollTop = element.scrollHeight; });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div className="caption-wrap"><div className="captions" ref={ref} tabIndex={0} role="log" aria-label="Išgirstas tekstas ir vertimai" aria-live="off" onWheel={scrollIntent} onTouchStart={scrollIntent} onTouchMove={scrollIntent} onPointerDown={scrollIntent} onKeyDown={scrollIntent} onScroll={scrolledByUser}>{rows.map((row) => <article className={`caption ${row.role} ${selectedId === row.id ? 'is-selected' : ''}`} key={row.id}>{row.role === 'assistant' && onSelect ? <button className="caption-select" aria-pressed={selectedId === row.id} aria-label={`Pasirinkti vertimą: ${row.text}`} onClick={() => onSelect(row)}><span className="caption-label">{selectedId === row.id ? 'Pasirinktas vertimas' : 'Vertimas'}</span><span className="caption-text">{row.text}</span></button> : <><span className="caption-label">{row.role === 'user' ? 'Išgirsta' : 'Vertimas'}</span><p>{row.text}</p></>}</article>)}</div>{scrolled && <button className="latest-button" onClick={() => { scrollIntentUntil.current = 0; follow.current = true; ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }); setScrolled(false); }}><ArrowDown size={19} /> Naujausias vertimas</button>}</div>;
}
