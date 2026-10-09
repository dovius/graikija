import { LoaderCircle, Square, Volume2 } from 'lucide-react';
import type { ConversationNote } from '../../shared/types';
import { Modal, Notice } from './UI';

export function ConversationNoteDialog({ purpose, note, busy, error, retry, speak, onClose, audioBusy, audioPlaying, audioBlocked, audioError, stopAudio, resumeAudio }: {
  purpose: 'recap' | 'explain'; note?: ConversationNote; busy: boolean; error: string; retry: () => void; speak: (text: string) => void; onClose: () => void;
  audioBusy: boolean; audioPlaying: boolean; audioBlocked: boolean; audioError: string; stopAudio: () => void; resumeAudio: () => void;
}) {
  return <Modal title={purpose === 'recap' ? 'Ką sutarėme?' : 'Paaiškink man'} className="conversation-note" onClose={onClose} footer={<>
    {note && <button className="button secondary full-width" onClick={() => audioBlocked ? resumeAudio() : audioPlaying || audioBusy ? stopAudio() : speak(note.text)}>{audioPlaying || audioBusy ? <Square size={23} /> : <Volume2 size={23} />}{audioBlocked ? 'Paleisti garsą' : audioBusy ? 'Atšaukti garso ruošimą' : audioPlaying ? 'Stabdyti garsą' : 'Išklausyti'}</button>}
    <button className="button primary full-width note-return" onClick={onClose}>Grįžti į pokalbį</button>
  </>}>
    <p className="modal-lead">{purpose === 'recap' ? 'Užrašas pagal išgirstą pokalbį. Svarbias detales patikslinkite su pašnekovu.' : 'Paaiškinimas jums lietuviškai.'}</p>
    {busy && <p className="composer-status" role="status"><LoaderCircle className="spin" size={24} /> Skaitome pokalbį…</p>}
    {error && <Notice retry={retry}>{error}</Notice>}
    {note?.partial && <Notice>Pokalbis ilgas. Šis užrašas apima tik paskutinę jo dalį.</Notice>}
    {note?.agreement ? <><dl className="agreement-fields">{note.agreement.fields.map(field => <div key={field.label} data-certainty={field.status}><dt>{field.label}</dt><dd>{field.status === 'unclear' && <strong className="uncertain-label">Reikia patikslinti</strong>}{field.value}{field.evidence.length > 0 && <details><summary>Kas buvo pasakyta</summary>{field.evidence.map((item, index) => <blockquote key={`${item.id}-${index}`}>{item.quote}</blockquote>)}</details>}</dd></div>)}</dl>{note.agreement.questions.length > 0 && <div className="agreement-questions"><h3>Verta paklausti</h3><ul>{note.agreement.questions.map(question => <li key={question}>{question}</li>)}</ul></div>}</> : note && <p className="explanation-text">{note.text}</p>}
    {audioError && <Notice>{audioError}</Notice>}
  </Modal>;
}
