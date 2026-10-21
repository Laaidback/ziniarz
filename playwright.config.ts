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
    // With Google ids, so the Drive buttons are there; e2e/fakeGoogle.ts stands in for Google itself.
    command: `VITE_GOOGLE_CLIENT_ID=e2e-client VITE_GOOGLE_API_KEY=e2e-key VITE_GOOGLE_APP_ID=1 npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
