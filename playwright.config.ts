import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  webServer: {
    command: 'AUDIT_E2E_MODE=1 PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:4173 pnpm exec next dev -H 0.0.0.0 -p 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
})
