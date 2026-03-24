const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'python3 -m http.server 4174',
    port: 4174,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'mobile',  use: { viewport: { width: 390,  height: 844  } } },
    { name: 'tablet',  use: { viewport: { width: 820,  height: 1180 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900  } } },
  ],
});
