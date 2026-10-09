export const MAX_LIVE_MS = 30 * 60_000;
export const LIVE_RETRY_MS = 30_000;
export const liveRetryDelay = (attempt: number) => Math.min(LIVE_RETRY_MS * 2 ** Math.min(Math.max(attempt - 1, 0), 4), 5 * 60_000);
