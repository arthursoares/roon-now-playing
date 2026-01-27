import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environmentMatchGlobs: [
      // Client tests need jsdom for browser APIs
      ['packages/client/**', 'jsdom'],
      // Server and shared tests use node
      ['packages/server/**', 'node'],
      ['packages/shared/**', 'node'],
    ],
  },
  resolve: {
    alias: {
      '@roon-screen-cover/shared': resolve(__dirname, 'packages/shared/src'),
    },
  },
});
