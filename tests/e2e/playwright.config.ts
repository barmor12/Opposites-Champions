import { defineConfig, devices } from '@playwright/test';

/**
 * בדיקות קצה-לקצה: מריצות את השרת (dist) ואת ה־Vite dev server.
 * דורש: מסד נתונים זמין ב-apps/server/.env, build של השרת, seed.
 */
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const API_PORT = process.env.E2E_API_PORT ?? '3000';

export default defineConfig({
  testDir: './specs',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    locale: 'he-IL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // אפשרות להשתמש בדפדפן מותקן מראש (למשל בסביבות ענן) במקום ההורדה של Playwright
    ...(process.env.PW_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
      : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
  ],
  webServer: process.env.E2E_NO_SERVERS
    ? undefined
    : [
        {
          command: `node dist/apps/server/src/main.js`,
          cwd: '../../apps/server',
          url: `http://localhost:${API_PORT}/api/health`,
          reuseExistingServer: true,
          timeout: 60_000,
          env: { PORT: API_PORT, NODE_ENV: 'development' },
        },
        {
          command: 'pnpm exec vite --port 5173 --strictPort',
          cwd: '../../apps/web',
          url: WEB_URL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
});
