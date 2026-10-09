import { z } from 'zod';
import type { ChatResult } from '../shared/types';
import type { chatSchema } from './validation';
import { ServiceError } from './openai';

const labels = ['Data', 'Laikas', 'Žmonių skaičius', 'Vieta', 'Kaina', 'Kitos sąlygos'] as const;
export const agreementSchema = z.object({
  fields: z.array(z.object({
    label: z.enum(labels), value: z.string().min(1).max(600),
    status: z.enum(['heard', 'unclear', 'missing']),
    evidence: z.array(z.object({ id: z.string().max(200), quote: z.string().min(1).max(600) }).strict()).max(3),
  }).strict()).length(6),
  questions: z.array(z.string().min(1).max(400)).max(3),
}).strict();
export const agreementFormat = { type: 'json_schema', name: 'conversation_note', strict: true, schema: z.toJSONSchema(agreementSchema) };

export function validateConversationAnswer(result: ChatResult, input: z.infer<typeof chatSchema>): ChatResult {
  if (input.purpose !== 'recap') return result;
  const invalid = () => new ServiceError(502, 'invalid_recap', 'Nepavyko patikimai susieti santraukos su pokalbiu. Pabandykite dar kartą.');
  let parsed: unknown;
  try { parsed = JSON.parse(result.text); } catch { throw invalid(); }
  const checked = agreementSchema.safeParse(parsed);
  if (!checked.success || new Set(checked.data.fields.map(field => field.label)).size !== labels.length) throw invalid();
  const agreement = checked.data;
  const heard = new Map(input.transcript?.filter(row => row.role === 'user').map(row => [row.id, row.text]));
  for (const field of agreement.fields) {
    if (field.status === 'missing') { field.value = 'Nepaminėta'; field.evidence = []; continue; }
    // A translation alone cannot corroborate what a person said. Require an
    // exact source quote; do not turn an ungrounded model answer into a card.
    if (!field.evidence.length || field.evidence.some(item => !heard.get(item.id)?.includes(item.quote))) throw invalid();
  }
  agreement.fields.sort((a, b) => labels.indexOf(a.label) - labels.indexOf(b.label));
  const text = ['Pokalbio užrašas. Detales patikslinkite su pašnekovu.', ...agreement.fields.map(field => `${field.label}: ${field.status === 'unclear' ? 'Reikia patikslinti. ' : ''}${field.value}`), ...agreement.questions].join('\n');
  return { text, sources: [], agreement };
}
