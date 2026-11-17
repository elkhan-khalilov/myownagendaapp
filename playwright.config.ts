import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the production static build (./out).
 * Run: npm run build && npm run test:e2e
 * Uses Chromium emulating the iPhone 13 Pro Max viewport. This is NOT real iOS Safari.
 * Set CHROME_PATH to use a system Chrome instead of a Playwright-downloaded browser.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 428, height: 926 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'allow',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: {
    command: 'npx serve out -l 4173 --no-clipboard',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
