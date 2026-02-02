import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for visual layout testing
 * Tests various viewport sizes: TVs, tablets, and monitors
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    // Base URL for local dev server
    baseURL: 'http://localhost:5174',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshots on failure
    screenshot: 'only-on-failure',
  },

  projects: [
    // === TVs ===
    {
      name: 'TV-1080p',
      use: {
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'TV-4K',
      use: {
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 1,
      },
    },

    // === Tablets ===
    // Note: Using chromium with iPad viewport dimensions (webkit requires separate install)
    {
      name: 'iPad-landscape',
      use: {
        viewport: { width: 1194, height: 834 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'iPad-portrait',
      use: {
        viewport: { width: 834, height: 1194 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Android-tablet-landscape',
      use: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
        userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36',
      },
    },
    {
      name: 'Android-tablet-portrait',
      use: {
        viewport: { width: 800, height: 1280 },
        deviceScaleFactor: 2,
        userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36',
      },
    },

    // === Monitors ===
    {
      name: 'Monitor-16x10-WQXGA',
      use: {
        viewport: { width: 2560, height: 1600 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'Monitor-16x9-1440p',
      use: {
        viewport: { width: 2560, height: 1440 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'Monitor-ultrawide',
      use: {
        viewport: { width: 3440, height: 1440 },
        deviceScaleFactor: 1,
      },
    },
  ],

  // Run local dev server before tests
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
