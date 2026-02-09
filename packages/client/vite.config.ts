import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    legacy({
      // Target very old browsers for basic layout compatibility
      // iOS 9.3.5, iOS 12.x, Android 4.4
      targets: ['iOS >= 9', 'Android >= 4.4', 'Chrome >= 49', 'Safari >= 9'],
      // Generate legacy chunks for older browsers
      renderLegacyChunks: true,
      // Polyfill modern JS features
      polyfills: true,
      // Automatically detect which polyfills are needed
      modernPolyfills: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
