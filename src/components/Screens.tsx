import { useRef, useState, type ChangeEvent } from 'react';
import { ArrowRight, Camera, Check, ImagePlus, LoaderCircle, MessageCircle, Mic, ParkingCircle, PhoneOff, TrainFront, Utensils } from 'lucide-react';
import type { Message, PhotoContext } from '../../shared/types';
import type { ListeningWarning } from '../lib/listeningGuard';
import type { useChat } from '../hooks/useChat';
import { Composer, Conversation, Modal, Notice, ScreenHeader } from './UI';
import { PhotoIllustration } from './Illustrations';

type ChatController = ReturnType<typeof useChat>;

export function ListeningWarningDialog({ warning, onContinue, onEnd }: { warning: ListeningWarning; onContinue: () => void; onEnd: () => void }) {
  return <Modal title="Ar dar kalbatės?" className="listening-warning" onClose={onEnd} dismissible={false}>
    <p className="modal-lead">{warning.reason === 'silence' ? 'Kurį laiką negavome naujos išgirstos kalbos.' : 'Pokalbis trunka beveik 10 minučių.'}</p>
    <p className="listening-countdown">Mikrofonas išsijungs po <strong>{warning.seconds} s</strong></p>
    <div className="listening-actions"><button className="button primary" autoFocus onClick={onContinue}><Mic size={23} aria-hidden="true" /> Tęsti pokalbį</button><button className="button secondary" onClick={onEnd}><PhoneOff size={22} aria-hidden="true" /> Baigti pokalbį</button></div>
  </Modal>;
}

export { LiveScreen } from './LiveScreen';

export function PhotoScreen({ photo, chat, selecting, error, draft, setDraft, onBack, onPhoto, speak }: { photo: PhotoContext | null; chat: ChatController; selecting: boolean; error: string; draft: string; setDraft: (value: string) => void; onBack: () => void; onPhoto: (file: File) => void; speak: (text: string) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const [changePhoto, setChangePhoto] = useState(false);
  const change = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onPhoto(file); event.target.value = ''; };
  return <main className="tool-page photo-page" id="main-content" data-has-messages={Boolean(photo)}><ScreenHeader eyebrow="NUOTRAUKOS VERTIMAS" title="Kas čia parašyta?" description="Nufotografuokite. Paaiškinsime lietuviškai." onBack={onBack} />
    <input ref={camera} type="file" accept="image/*" capture="environment" onChange={change} className="sr-only" tabIndex={-1} aria-label="Fotografuoti kamera" /><input ref={upload} type="file" accept="image/*" onChange={change} className="sr-only" tabIndex={-1} aria-label="Pasirinkti nuotraukos failą" />
    {error && <Notice>{error}</Notice>}
    {!photo ? <><div className="photo-upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files[0] && !selecting) onPhoto(event.dataTransfer.files[0]); }}><PhotoIllustration /><h2>{selecting ? 'Ruošiame nuotrauką…' : 'Graikija – aiškiau lietuviškai.'}</h2><p>Meniu, kelio ženklas, bilietas ar etiketė.<br />Užtenka vienos nuotraukos.</p><button className="button primary large" onClick={() => camera.current?.click()} disabled={selecting}>{selecting ? <LoaderCircle size={25} className="spin" /> : <Camera size={25} />} {selecting ? 'Ruošiame nuotrauką…' : 'Fotografuoti'}</button><button className="upload-button" onClick={() => upload.current?.click()} disabled={selecting}><ImagePlus size={22} /> Pasirinkti iš nuotraukų</button></div><div className="photo-examples"><span><Utensils size={21} /> Meniu</span><span><ParkingCircle size={21} /> Ženklai</span><span><TrainFront size={21} /> Bilietai</span></div><div className="gentle-note"><Camera size={23} /><p>Telefonas gali paprašyti leidimo naudoti kamerą. Pasirinkite „Leisti“. Visada galite įkelti jau turimą nuotrauką.</p></div></> : <>
      <div className="photo-context"><img src={photo.dataUrl} alt="Jūsų verčiama nuotrauka" /><div><p><Check size={19} /> Jūsų nuotrauka</p><button className="button secondary photo-change-button" onClick={() => setChangePhoto(true)} disabled={chat.busy || selecting}><Camera size={21} />Keisti nuotrauką</button></div></div>
      {selecting && <p className="composer-status" role="status"><LoaderCircle className="spin" size={22} /> Ruošiame nuotrauką…</p>}
      <Conversation messages={photo.messages} busy={chat.busy} onSpeak={speak} />
      {(chat.error || chat.unanswered) && <Notice retry={chat.retry}>{chat.error || 'Šis klausimas dar neturi atsakymo. Galite pabandyti dar kartą.'}</Notice>}
      {photo.messages.some((m) => m.role === 'assistant') && <p className="followup-label">Norite sužinoti daugiau?</p>}
      <Composer photo draft={draft} setDraft={setDraft} onSend={chat.send} disabled={chat.busy || selecting} />
    </>}
    <p className="privacy-note">Nuotrauka išsaugoma šiame telefone. Vertimui ji siunčiama „OpenAI“.</p>
    {changePhoto && <Modal title="Kita nuotrauka" onClose={() => setChangePhoto(false)}><div className="photo-choice"><button className="button primary full-width" onClick={() => { camera.current?.click(); setChangePhoto(false); }}><Camera size={24} />Fotografuoti</button><button className="button secondary full-width" onClick={() => { upload.current?.click(); setChangePhoto(false); }}><ImagePlus size={24} />Pasirinkti iš nuotraukų</button></div></Modal>}
  </main>;
}

const questions = [
  { icon: Utensils, text: 'Kaip paprašyti sąskaitos?' },
  { icon: TrainFront, text: 'Kaip nusipirkti traukinio bilietą?' },
  { icon: MessageCircle, text: 'Kaip paprašyti sąskaitos graikiškai?' },
  { icon: ParkingCircle, text: 'Kaip paklausti, kur galima statyti?' },
];
export function AssistantScreen({ messages, chat, draft, setDraft, onBack, speak, clear }: { messages: Message[]; chat: ChatController; draft: string; setDraft: (value: string) => void; onBack: () => void; speak: (text: string) => void; clear: () => void }) {
  return <main className="tool-page assistant-page" id="main-content" data-has-messages={messages.length > 0}><ScreenHeader eyebrow="KELIONĖS ASISTENTAS" title="Paklauskite patarimo" description="Apie maistą, transportą ir kelionę Rodo saloje." onBack={onBack} />
    {!messages.length ? <section className="assistant-welcome"><div className="assistant-symbol"><MessageCircle size={36} strokeWidth={1.6} /><span className="sparkle-small" aria-hidden="true">✧</span></div><h2>Jūsų klausimams – vietos visada yra.</h2><p>Parašykite arba pasakykite, kas rūpi.<br />Atsakysime paprastai, lietuviškai.</p></section> : <><div className="chat-toolbar"><span><span className="mini-dot" /> Jūsų pokalbis</span><button className="text-button" onClick={clear} disabled={chat.busy}>Naujas pokalbis</button></div><Conversation messages={messages} busy={chat.busy} onSpeak={speak} />{(chat.error || chat.unanswered) && <Notice retry={chat.retry}>{chat.error || 'Paskutinis klausimas liko be atsakymo. Galite jį išsiųsti dar kartą.'}</Notice>}</>}
    <Composer draft={draft} setDraft={setDraft} onSend={chat.send} disabled={chat.busy} />
    {!messages.length && <section className="assistant-suggestions"><div className="suggested-label">Galite paklausti</div><div className="question-grid">{questions.map(({ icon: Icon, text }) => <button key={text} onClick={() => chat.send(text)}><Icon size={23} /><span>{text}</span><ArrowRight size={19} /></button>)}</div></section>}
    <p className="privacy-note">Atsakymus kuria dirbtinis intelektas. Svarbias detales pasitikrinkite.</p>
  </main>;
}
