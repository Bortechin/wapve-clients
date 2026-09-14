import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const testsExternalDeployment = Boolean(process.env.PLAYWRIGHT_BASE_URL);

const smokeConfig = {
  testDir: './e2e',
  testMatch: /smoke\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  use: { baseURL, trace: 'retain-on-failure' as const },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
};

export default testsExternalDeployment
  ? defineConfig(smokeConfig)
  : defineConfig({
      ...smokeConfig,
      webServer: {
        command: 'pnpm --filter @wapve/web dev',
        url: 'http://127.0.0.1:3000/login',
        reuseExistingServer: true,
        timeout: 120_000,
      },
    });
