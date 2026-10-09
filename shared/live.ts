import type { LivePreferences } from './types';

export const LIVE_PROMPT_VERSION = '2026-10-08.el.1';
export const DEFAULT_LIVE_PREFERENCES: LivePreferences = { direction: 'auto', slow: false };
export const liveDiagnosticTypes = ['started', 'first_input', 'first_output', 'playback_blocked', 'playback_ready', 'pause', 'listen', 'show', 'replay', 'replay_slow', 'preferences', 'reconnect', 'end', 'closed', 'pending_captions'] as const;
export interface LiveDiagnostic { id: string; at: number; type: typeof liveDiagnosticTypes[number]; value?: string | number }
export interface LiveMetadata { conversationId?: string; promptVersion: string; startReason: 'new' | 'resume' | 'reconnect'; preferences: LivePreferences }

// Trusted UI choices only. Never interpolate speech or caption text into instructions.
export function livePreferenceInstructions({ direction, slow }: LivePreferences) {
  const language = direction === 'toGreek'
    ? 'Dabar pasirinkta kryptis: kalba keliautojas. Visą naują kalbą versk tik į graikų kalbą.'
    : direction === 'toLithuanian'
      ? 'Dabar pasirinkta kryptis: kalba pašnekovas. Visą naują kalbą versk tik į lietuvių kalbą.'
      : 'Dabar kryptis automatinė: lietuvių į graikų; graikų, anglų ir ispanų į lietuvių. Vien OK, mhm ar vardas krypties nekeičia.';
  return `${language}\n${slow ? 'Kalbėk lėčiau, su trumpomis pauzėmis tarp prasminių dalių. Ypač aiškiai tark visus skaičius ir laikus.' : 'Kalbėk aiškiai, natūraliu, neskubriu tempu.'}\nŠio pakeitimo neįgarsink. Pradėk tik išgirdęs naują kalbą; ankstesnio vertimo nekartok.`;
}
