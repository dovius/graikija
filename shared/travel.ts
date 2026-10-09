// Public country configuration only; never put credentials or traveler data here.
export const TRAVEL = {
  id: 'graikija-vertejas',
  name: 'Graikija',
  title: 'Kelionės vertėjas · Graikija arčiau',
  destination: 'Rodo sala (Rhodes / Ρόδος), Graikija',
  language: 'el',
  locale: 'el-GR',
  uiLocale: 'lt-LT',
} as const;

// Choose the dominant letter script, not a quoted place name. Ambiguous text
// falls back to Lithuanian, including Lithuanian written without accents.
export function speechLocale(text: string): string {
  const greek = text.match(/\p{Script=Greek}/gu)?.length ?? 0;
  const latin = text.match(/\p{Script=Latin}/gu)?.length ?? 0;
  return greek > latin ? TRAVEL.locale : TRAVEL.uiLocale;
}

export const TRAVEL_CONTEXT = `Numatytoji kelionės kryptis – ${TRAVEL.destination}, ne Roda kaimas Korfu saloje. Tai kelionės kontekstas, ne patvirtinta žmogaus buvimo vieta. Graikiškoms frazėms vartok šiuolaikinę graikų kalbą.`;
