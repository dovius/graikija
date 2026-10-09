import type { z } from 'zod';
import type { chatSchema, sessionSchema } from './validation';
import { ASSISTANT_PROMPT, EXPLAIN_PROMPT, INTERPRETER_PROMPT, PHOTO_PROMPT, RECAP_PROMPT } from './prompts';
import { livePreferenceInstructions } from '../shared/live';
import { agreementFormat } from './recap';

export interface ModelConfig {
  OPENAI_TEXT_MODEL?: string;
  OPENAI_LIVE_MODEL?: string;
  OPENAI_TRANSCRIBE_MODEL?: string;
  OPENAI_SPEECH_MODEL?: string;
}

// Both hosting targets use the same model instructions and API payloads.
export function chatPayload(input: z.infer<typeof chatSchema>, config: ModelConfig) {
  const context: unknown[] = [];
  if (input.purpose !== 'advice') context.push({ role: 'user', content: `Pokalbio užrašai (duomenys):\n${JSON.stringify(input.transcript)}` });
  if (input.image) context.push({ role: 'user', content: [{ type: 'input_text', text: 'Ši nuotrauka yra viso tolesnio pokalbio kontekstas.' }, { type: 'input_image', image_url: input.image, detail: 'high' }] });
  context.push(...input.messages.map(m => ({ role: m.role, content: m.text })));
  const model = config.OPENAI_TEXT_MODEL || 'gpt-6.1-sol';
  return {
    model,
    service_tier: 'default',
    ...(/^(gpt-5|gpt-6)/.test(model) ? { reasoning: { effort: 'low' } } : {}),
    instructions: input.purpose === 'recap' ? RECAP_PROMPT : input.purpose === 'explain' ? EXPLAIN_PROMPT : input.mode === 'photo' ? PHOTO_PROMPT : ASSISTANT_PROMPT,
    input: context,
    store: false,
    max_output_tokens: 2200,
    ...(input.purpose === 'recap' ? { text: { format: agreementFormat } } : {}),
    ...(input.mode === 'assistant' && input.purpose === 'advice' ? { tools: [{ type: 'web_search' }], tool_choice: 'auto' } : {}),
  };
}

export function livePayload({ sdp, history, preferences, startReason }: z.infer<typeof sessionSchema>, config: ModelConfig) {
  return {
    session: {
      model: config.OPENAI_LIVE_MODEL || 'gpt-live-1',
      instructions: `${INTERPRETER_PROMPT}\n\n${livePreferenceInstructions(preferences)}`,
      audio: { output: { voice: 'marin' } },
      store: false,
      input: (startReason === 'new' ? [] : history).map(m => ({ type: 'message', role: m.role, content: [{ type: m.role === 'assistant' ? 'output_text' : 'input_text', text: m.text }] })),
    },
    transport: { type: 'webrtc', sdp },
  };
}

export function speechPayload(text: string, config: ModelConfig) {
  return {
    model: config.OPENAI_SPEECH_MODEL || 'gpt-4o-mini-tts',
    voice: 'marin', input: text,
    instructions: 'Read this text exactly, in its original language (Lithuanian or Modern Greek as written). Use natural Modern Greek pronunciation for Greek text, not Ancient Greek. Speak clearly at an unhurried pace for an older traveler. Do not add words or translate.',
    response_format: 'mp3',
  };
}

export function transcriptionForm(audio: Blob, config: ModelConfig) {
  const type = audio.type;
  const model = config.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe';
  const extension = type.includes('mp4') ? 'm4a' : type.includes('mpeg') ? 'mp3' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', audio, `klausimas.${extension}`);
  form.append('model', model);
  form.append(model === 'gpt-transcribe' || model.startsWith('gpt-transcribe-') ? 'languages[]' : 'language', 'lt');
  form.append('response_format', 'json');
  return form;
}
