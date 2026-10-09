import { defineConfig, devices } from '@playwright/test';

const cloudflare = process.env.E2E_TARGET === 'cloudflare';
const port = Number(process.env.E2E_PORT || 4173);

export default defineConfig({
  testDir: './tests/browser',
  outputDir: process.env.E2E_OUTPUT_DIR || 'test-results',
  fullyParallel: true,
  workers: 3,
  timeout: 30_000,
  expect: { timeout: 8000 },
  use: { baseURL: `http://127.0.0.1:${port}`, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } } },
    { name: 'android', use: { ...devices['Pixel 7'], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } } },
    { name: 'iphone', use: { ...devices['iPhone 13'], launchOptions: { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE } } },
  ],
  webServer: {
    // A fresh test store preserves real login rate limits without inheriting
    // attempts (or trip data) from an earlier run or a developer's cf:dev.
    command: cloudflare ? `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false npx wrangler dev --port ${port} --persist-to .wrangler/e2e-state-${process.pid} --var OPENAI_API_KEY:browser-test-placeholder --var TRIP_ACCESS_TOKEN: --var STATS_ADMIN_PASSWORD:browser-test-admin-password --var NTFY_TOPIC_URL: --var NTFY_TOKEN: --show-interactive-dev-session=false` : `PORT=${port} npm start`,
    env: { OPENAI_API_KEY: 'browser-test-placeholder', STATS_ADMIN_PASSWORD: 'browser-test-admin-password', STATS_DB_PATH: ':memory:', NTFY_TOPIC_URL: '', NTFY_TOKEN: '', TRIP_ACCESS_TOKEN: '' },
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !cloudflare && !process.env.CI,
    timeout: 30_000,
  },
});
