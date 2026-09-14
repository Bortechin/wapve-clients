import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: /support-v2\.spec\.ts/,
  workers: 1,
  timeout: 120000,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', locale: 'tr-TR' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'tablet', use: { ...devices['iPad Mini'], browserName: 'chromium' } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm exec next dev --webpack --port 3100',
    url: 'http://127.0.0.1:3100/support/staff',
    reuseExistingServer: true,
    timeout: 180000,
  },
});
