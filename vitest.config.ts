import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['packages/{server,shared}/src/**/*.{test,spec}.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        extends: true,
        root: resolve(__dirname, 'packages/client'),
        test: {
          name: 'client',
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          environment: 'jsdom',
          execArgv: process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')
            ? ['--no-experimental-webstorage']
            : [],
          environmentOptions: {
            jsdom: {
              url: 'http://localhost/',
            },
          },
          setupFiles: [resolve(__dirname, 'vitest.setup.client.ts')],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@roon-screen-cover/shared': resolve(__dirname, 'packages/shared/src'),
    },
  },
});
