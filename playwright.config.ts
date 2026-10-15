import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** End-to-end tests against the production build (`npm run test:e2e`). Kept out of `npm test`. */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-output/e2e',
  timeout: 120_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
