import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const enableBillingTests = process.env.ENABLE_BILLING_TESTS === 'true';

const testIgnore: string[] = [];

if (!enableBillingTests) {
  console.log(
    `Billing tests are disabled. To enable them, set the environment variable ENABLE_BILLING_TESTS=true.`,
    `Current value: "${process.env.ENABLE_BILLING_TESTS}"`
  );

  testIgnore.push('*-billing.spec.ts');
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  testIgnore,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SERVER_COMMAND
    ? {
        cwd: '../../',
        command: process.env.PLAYWRIGHT_SERVER_COMMAND,
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
});
