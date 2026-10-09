import type { StatsConfig } from '../shared/stats';
import type { BrowserPublish, NotificationMessage } from '../shared/notifications';
import { ServiceError } from './openai';

export const browserDelivery = (config: StatsConfig) => Boolean(config.STATS_ADMIN_PASSWORD && config.NTFY_TOPIC_URL && config.NTFY_DELIVERY === 'browser' && !config.NTFY_TOKEN);

function prepareNotification(config: StatsConfig, notification: NotificationMessage): BrowserPublish {
  const configured = config.NTFY_TOPIC_URL?.trim();
  if (!configured) throw new ServiceError(503, 'ntfy_not_configured', 'Serveryje nenustatyta „ntfy“ tema.');
  let endpoint: URL;
  let topic: string;
  try {
    // Accept the topic name people copy from ntfy, as well as a full URL.
    endpoint = new URL(/^[A-Za-z0-9_-]+$/.test(configured) ? `https://ntfy.sh/${configured}` : configured);
    if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error();
    topic = endpoint.pathname.split('/').filter(Boolean).at(-1) || '';
    if (!/^[A-Za-z0-9_-]+$/.test(topic)) throw new Error();
    endpoint.pathname = endpoint.pathname.slice(0, endpoint.pathname.lastIndexOf(topic));
    endpoint.search = ''; endpoint.hash = '';
  } catch {
    throw new ServiceError(503, 'ntfy_invalid_topic', 'Neteisingas „ntfy“ temos adresas. Patikrinkite NTFY_TOPIC_URL serveryje.');
  }
  return { url: endpoint.href, payload: { ...notification, topic } };
}

export function prepareBrowserNotification(config: StatsConfig, notification: NotificationMessage): BrowserPublish {
  const result = prepareNotification(config, notification);
  if (config.NTFY_TOKEN || result.url !== 'https://ntfy.sh/') throw new ServiceError(503, 'ntfy_browser_config', 'Siuntimui iš naršyklės naudokite viešą ntfy.sh temą be serverio prieigos rakto.');
  return result;
}

export async function publishNotification(config: StatsConfig, notification: NotificationMessage, fetcher: typeof fetch) {
  const { url, payload } = prepareNotification(config, notification);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.NTFY_TOKEN ? { Authorization: `Bearer ${config.NTFY_TOKEN}` } : {}) },
      body: JSON.stringify(payload), signal: controller.signal, redirect: 'manual',
    });
    // Never expose upstream bodies: they can echo notification text or tokens.
    await response.body?.cancel().catch(() => {});
    if (response.ok) return;
    if (response.status === 401 || response.status === 403) throw new ServiceError(502, 'ntfy_auth', `„ntfy“ neleidžia siųsti į šią temą (HTTP ${response.status}). Patikrinkite temos prieigą ir NTFY_TOKEN serveryje.`);
    if (response.status === 429) throw new ServiceError(502, 'ntfy_rate_limit', '„ntfy“ siuntimo limitas pasiektas (HTTP 429). Pabandykite vėliau arba patikrinkite „ntfy“ plano limitus.');
    throw new ServiceError(502, 'ntfy_http', `„ntfy“ atmetė pranešimą (HTTP ${response.status}). Patikrinkite temos adresą ir bandykite dar kartą.`);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(502, controller.signal.aborted ? 'ntfy_timeout' : 'ntfy_network', controller.signal.aborted ? '„ntfy“ neatsakė per 8 sekundes. Pabandykite dar kartą.' : 'Serveriui nepavyko susisiekti su „ntfy“. Pabandykite dar kartą.');
  } finally { clearTimeout(timeout); }
}
