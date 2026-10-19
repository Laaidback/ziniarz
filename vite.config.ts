import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Pre-bundle so the first browser test run is not reloaded mid-run.
  optimizeDeps: {
    include: [
      'konva',
      'pdf-lib',
      'idb',
      'jszip',
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'zustand',
      'zustand/vanilla',
      'three',
      'three/examples/jsm/controls/OrbitControls.js',
      'vitest-browser-react',
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'src/**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
          // Ayuthaya (a macOS system font) counts as missing unless a test turns it on.
          setupFiles: ['src/test/browserSetup.ts'],
          // UPDATE_REFERENCES=1 (npm run test:update-references) rewrites the render references.
          // In CI (CI is set, as GitHub does) the render references are only informational and the comparison is
          // skipped unless REFERENCE_STRICT=1; the workflow runs it separately with continue-on-error.
          provide: {
            updateReferences: process.env.UPDATE_REFERENCES === '1',
            skipReferences: Boolean(process.env.CI) && process.env.REFERENCE_STRICT !== '1' && process.env.UPDATE_REFERENCES !== '1',
          },
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            // The default 414 px wide viewport is too small for the editor layout.
            viewport: { width: 1280, height: 900 },
            instances: [{ browser: 'chromium', launch: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } }],
          },
        },
      },
    ],
  },
});
