import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Use jsdom for all tests - server tests still work in jsdom
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@roon-screen-cover/shared': resolve(__dirname, 'packages/shared/src'),
    },
  },
});
