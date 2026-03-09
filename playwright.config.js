const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: `http://${process.env.E2E_APP_IP || '172.31.0.10'}`,
    viewport: { width: 390, height: 844 },
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  reporter: [['html', { open: 'never' }], ['list']],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
