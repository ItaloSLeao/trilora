import { defineConfig } from '@playwright/test'
const baseURL = 'http://127.0.0.1:4179'
export default defineConfig({
  testDir: 'checks/browser',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Bahia',
    viewport: { width: 1360, height: 900 },
    launchOptions: { executablePath: process.env.ATLAS_CHROMIUM || undefined },
  },
  webServer: {
    command: 'npm run preview -- --port 4179 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
})
