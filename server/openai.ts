export class ServiceError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const localKey = () => typeof process === 'undefined' ? undefined : process.env.OPENAI_API_KEY;

export function requireKey(key: string | undefined = localKey()) {
  if (!key) {
    throw new ServiceError(503, 'not_configured', 'Vertėjas dar neparuoštas. Paprašykite kelionės organizatoriaus jį įjungti.');
  }
}

// Native fetch keeps the backend small and follows the documented Live HTTP contract.
// No upstream payload, request body or key is logged or forwarded as an error.
export const openaiRequest = (path: string, body?: unknown, timeout = 60_000): Promise<Response> => requestWithKey(localKey(), path, body, timeout);

// Workers inject secrets through bindings; the Node server continues to use .env.
export function createOpenAIRequest(key?: string, fetcher: typeof fetch = (input, init) => fetch(input, init)): typeof openaiRequest {
  return (path, body, timeout = 60_000) => requestWithKey(key, path, body, timeout, fetcher);
}

async function requestWithKey(key: string | undefined, path: string, body: unknown, timeout: number, fetcher: typeof fetch = (input, init) => fetch(input, init)): Promise<Response> {
  requireKey(key);
  const multipart = body instanceof FormData;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const connectionError = () => new ServiceError(504, 'upstream_timeout', 'Ryšys su vertėju užtruko. Pabandykite dar kartą – jūsų tekstas ir nuotrauka išliko.');
  try {
    const response = await fetcher(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
    // A graceful session.close often wins the race with our HTTP fallback.
    // Only this session-specific provider code confirms there is no call left
    // to hang up. Authentication failures and other 404s must remain errors.
    if (response.status === 404 && /^live\/sessions\/[A-Za-z0-9_-]+\/hangup$/.test(path)) {
      const data = await response.json().catch(() => null) as { error?: { code?: string } } | null;
      if (data?.error?.code === 'session_id_not_found') { clearTimeout(timer); return new Response(null, { status: 204 }); }
    }
    // Consume the response without reflecting potentially sensitive diagnostics.
    if (!response.bodyUsed) await response.arrayBuffer();
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new ServiceError(503, 'service_unavailable', 'Vertėjas šiuo metu nepasiekiamas. Paprašykite kelionės organizatoriaus patikrinti paslaugą.');
    }
    if (response.status === 429) {
      throw new ServiceError(429, 'busy', 'Vertėjas dabar užimtas. Palaukite minutę ir pabandykite dar kartą.');
    }
      throw new ServiceError(502, 'upstream_error', 'Nepavyko gauti vertimo. Palaukite kelias akimirkas ir pabandykite dar kartą.');
    }
    if (!response.body) { clearTimeout(timer); return response; }
    // Preserve streaming speech, but end the deadline only after consumption or cancellation.
    const reader = response.body.getReader();
    return new Response(new ReadableStream({
      async pull(stream) {
        try {
          const { done, value } = await reader.read();
          if (done) { clearTimeout(timer); stream.close(); }
          else stream.enqueue(value);
        } catch { clearTimeout(timer); stream.error(connectionError()); }
      },
      cancel(reason) { clearTimeout(timer); return reader.cancel(reason); },
    }), response);
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof ServiceError) throw error;
    throw connectionError();
  }
}
