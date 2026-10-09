export type Screen = 'home' | 'live' | 'photo' | 'assistant';
export type ChatMode = 'photo' | 'assistant';
export interface Citation { title: string; url: string }
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Citation[];
}
export interface ChatResult { text: string; sources: Citation[]; agreement?: Agreement }
export type LiveDirection = 'auto' | 'toGreek' | 'toLithuanian';
export interface LivePreferences { direction: LiveDirection; slow: boolean }
export interface LiveConversationInfo { id: string; startedAt: number; truncated?: boolean }
export interface AgreementField {
  label: string;
  value: string;
  status: 'heard' | 'unclear' | 'missing';
  evidence: { id: string; quote: string }[];
}
export interface Agreement { fields: AgreementField[]; questions: string[] }
export interface ConversationNote extends ChatResult { conversationId: string; fragmentCount: number; snapshotId: string; purpose: 'recap' | 'explain'; partial: boolean }
export interface PhotoContext { dataUrl: string; name: string; messages: Message[] }
export interface TranscriptFragment {
  conversationId?: string;
  id: string;
  session: string;
  role: 'user' | 'assistant';
  text: string;
  start: number;
  end: number;
}
export interface TranscriptRow {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  session: string;
  start: number;
  end: number;
}
export interface SavedTrip {
  version: 1;
  photo: PhotoContext | null;
  assistant: Message[];
  transcripts: TranscriptFragment[];
  liveConversation?: LiveConversationInfo;
  liveConversations?: LiveConversationInfo[];
  livePreferences?: LivePreferences;
  liveNote?: ConversationNote;
  liveNotes?: ConversationNote[];
  drafts: { photo: string; assistant: string };
}
