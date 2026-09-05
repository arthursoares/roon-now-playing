import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from '../packages/shared/src/index.ts';

test.use({ timezoneId: 'UTC' });

async function setupDisplay(page: Page, settings: Partial<DisplaySettings> = {}) {
  await expect.poll(async () => {
    try { return (await page.request.get('http://localhost:3000/api/health')).status(); }
    catch { return 0; }
  }).toBe(200);
  // Keep global settings local to each browser fixture, so parallel viewport tests cannot change one another.
  let config: DisplaySettings = { ...DEFAULT_DISPLAY_SETTINGS, idleMode: 'clock', idleDelayMinutes: 1, ...settings };
  await page.routeWebSocket('**/ws**', (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      const data = JSON.parse(message.toString());
      socket.send(data.type === 'display_settings_update'
        ? JSON.stringify({ ...data, settings: config }) : message);
    });
  });
  await page.route('**/api/admin/display-settings', async (route) => {
    if (route.request().method() === 'POST') config = { ...config, ...route.request().postDataJSON() };
    await route.fulfill({ json: config });
  });
  await page.addInitScript(() => localStorage.setItem('roon-screen-cover:layout', 'detailed'));
  const zone = `idle-${randomUUID()}`;
  const artwork = fs.readFileSync(path.join(process.cwd(), 'assets/artwork_radiohead-in_rainbows.jpg')).toString('base64');
  async function playback(state: 'playing' | 'paused' | 'stopped') {
    const response = await page.request.post(`http://localhost:3000/api/sources/${zone}/now-playing`, {
      data: {
        zone_name: 'Listening room', state, title: '15 Step', artist: 'Radiohead', album: 'In Rainbows',
        artwork_base64: artwork, duration_seconds: 237, seek_position: 45,
      },
    });
    expect(response.ok()).toBe(true);
  }
  await playback('paused');
  await page.clock.install({ time: new Date('2026-09-05T21:59:00Z') });
  await page.goto(`/?layout=detailed&zone=${zone}`);
  await expect(page.locator('.detailed-layout')).toBeVisible();
  await expect(page.locator('.detailed-layout h1')).toHaveText('15 Step');
  return { playback, getSettings: () => config };
}

test('Smart Idle shows a clock, consumes a long wake gesture, and resumes with playback', async ({ page }, testInfo) => {
  const { playback } = await setupDisplay(page);
  await page.clock.fastForward(59_000);
  await expect(page.locator('.smart-idle')).toHaveCount(0);
  await page.clock.fastForward(2_000);
  await expect(page.locator('.smart-idle--clock')).toBeVisible();
  await expect(page.locator('.smart-idle__time')).not.toBeEmpty();
  const directory = path.join('e2e/screenshots/smart-idle', testInfo.project.name);
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, 'clock.jpg'), type: 'jpeg', quality: 85, animations: 'disabled' });

  await page.mouse.move(150, 150);
  await page.mouse.down();
  await expect(page.locator('.smart-idle')).toHaveCount(0);
  await page.clock.fastForward(2_000);
  await page.mouse.up();
  await expect(page.locator('.detailed-layout')).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect(page.locator('.smart-idle--clock')).toBeVisible();
  await playback('playing');
  await expect(page.locator('.smart-idle')).toHaveCount(0);
  await expect(page.locator('.detailed-layout')).toBeVisible();
});

test('Smart Idle swaps layouts without persisting them and applies night dimming', async ({ page }) => {
  const { playback } = await setupDisplay(page, {
    idleMode: 'layout', idleLayout: 'cover',
    nightDimmingEnabled: true, nightDimmingStart: '22:00', nightDimmingEnd: '07:00', nightBrightness: 20,
  });
  await expect(page.locator('.night-dimming-overlay')).toHaveCount(0);
  await page.clock.fastForward(61_000);
  await expect(page.locator('.cover-layout')).toBeVisible();
  await expect(page.locator('.night-dimming-overlay')).toHaveCSS('opacity', '0.8');
  expect(await page.evaluate(() => localStorage.getItem('roon-screen-cover:layout'))).toBe('detailed');
  await page.keyboard.press('Space');
  await expect(page.locator('.detailed-layout')).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect(page.locator('.cover-layout')).toBeVisible();
  await playback('playing');
  await expect(page.locator('.detailed-layout')).toBeVisible();
});

test('Smart Idle black screen wakes and the admin saves presentation settings', async ({ page }) => {
  const { getSettings } = await setupDisplay(page, { idleMode: 'black' });
  await page.clock.fastForward(61_000);
  await expect(page.locator('.smart-idle--black')).toBeVisible();
  await expect(page.locator('.smart-idle__clock')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(page.locator('.smart-idle')).toHaveCount(0);

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Display', exact: true }).click();
  await expect(page.locator('#idleMode')).toHaveValue('black');
  const response = page.waitForResponse((result) => result.url().endsWith('/api/admin/display-settings') && result.request().method() === 'POST');
  await page.locator('#idleMode').selectOption('clock');
  await page.clock.runFor(350);
  expect((await response).ok()).toBe(true);
  expect(getSettings().idleMode).toBe('clock');
});
