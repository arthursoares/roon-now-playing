import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DISPLAY_SETTINGS } from '../packages/shared/src/index.ts';

async function lockedDisplay(page: Page, idle = false) {
  let socket: WebSocketRoute;
  let announced = false;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.routeWebSocket('**/ws**', (connection) => {
    socket = connection;
    connection.onMessage((raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'client_metadata' && !announced) {
        announced = true;
        connection.send(JSON.stringify({ type: 'connection', status: 'connected', roon_connected: false, roon_enabled: false }));
        connection.send(JSON.stringify({ type: 'display_settings_update', settings: {
          ...DEFAULT_DISPLAY_SETTINGS, idleMode: idle ? 'clock' : 'off', idleDelayMinutes: 1,
        } }));
        connection.send(JSON.stringify({ type: 'remote_settings', lockInteractions: true, enabledLayouts: ['basic', 'detailed'] }));
        connection.send(JSON.stringify({ type: 'zones', zones: [{ id: 'fixture', display_name: 'Listening room' }] }));
      } else if (message.type === 'subscribe') {
        connection.send(JSON.stringify({ type: 'now_playing', zone_id: 'fixture', state: idle ? 'paused' : 'playing', seek_position: 42,
          track: { title: '15 Step', artist: 'Radiohead', album: 'In Rainbows', duration_seconds: 237, artwork_key: 'fixture' },
        }));
      }
    });
  });
  await page.route('**/api/artwork/fixture', (route) => route.fulfill({
    contentType: 'image/jpeg', body: fs.readFileSync(path.join(process.cwd(), 'assets/artwork_radiohead-in_rainbows.jpg')),
  }));
  if (idle) await page.clock.install({ time: new Date('2026-09-05T21:00:00Z') });
  await page.goto('/?layout=basic&zone=fixture');
  await expect(page.locator('.basic-layout .title')).toHaveText('15 Step');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('roon-screen-cover:lock-interactions'))).toBe('true');
  return {
    unlock: () => socket!.send(JSON.stringify({ type: 'remote_settings', lockInteractions: false })),
    errors,
  };
}

test('tap lock blocks layout and zone changes until it is disabled live', async ({ page }) => {
  const { unlock, errors } = await lockedDisplay(page);
  await page.locator('.now-playing').click();
  await expect(page.locator('.basic-layout')).toBeVisible();
  await page.locator('.now-playing').dblclick();
  await expect(page.locator('.basic-layout')).toBeVisible();
  await expect(page.locator('.zone-picker')).toHaveCount(0);

  unlock();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('roon-screen-cover:lock-interactions'))).toBeNull();
  await page.locator('.now-playing').click();
  await expect(page.locator('.detailed-layout')).toBeVisible();
  await page.locator('.now-playing').dblclick();
  await expect(page.locator('.zone-picker')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a locked display can wake from Smart Idle without changing layout or zone', async ({ page }) => {
  const { errors } = await lockedDisplay(page, true);
  await page.clock.fastForward(61_000);
  await expect(page.locator('.smart-idle--clock')).toBeVisible();
  await page.mouse.move(150, 150);
  await page.mouse.down();
  await expect(page.locator('.smart-idle')).toHaveCount(0);
  await page.clock.fastForward(2_000);
  await page.mouse.up();
  await expect(page.locator('.basic-layout')).toBeVisible();
  await expect(page.locator('.zone-picker')).toHaveCount(0);
  await page.clock.fastForward(1_000);
  await page.locator('.now-playing').click();
  await expect(page.locator('.basic-layout')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('roon-screen-cover:lock-interactions'))).toBe('true');
  expect(errors).toEqual([]);
});

for (const url of ['/admin', '/admin/screen/kiosk-screen']) {
  test(`${url} saves both lock states from the tap-controls checkbox`, async ({ page }, testInfo) => {
    let socket: WebSocketRoute;
    const pushed: boolean[] = [];
    const client = {
      clientId: 'fixture:display', friendlyName: 'kiosk-screen', layout: 'basic', font: 'system', background: 'black',
      zoneId: 'fixture', zoneName: 'Listening room', connectedAt: Date.now(), userAgent: 'Fixture display',
      isAdmin: false, lockInteractions: false,
    };
    await page.routeWebSocket('**/ws**', (connection) => {
      socket = connection;
      connection.onMessage(() => {
        connection.send(JSON.stringify({ type: 'connection', status: 'connected', roon_connected: false, roon_enabled: false }));
        connection.send(JSON.stringify({ type: 'clients_list', clients: [client] }));
        connection.send(JSON.stringify({ type: 'zones', zones: [{ id: 'fixture', display_name: 'Listening room' }] }));
      });
    });
    await page.route('**/api/**', async (route) => {
      if (new URL(route.request().url()).pathname === '/api/admin/clients/fixture:display/push') {
        client.lockInteractions = route.request().postDataJSON().lockInteractions;
        pushed.push(client.lockInteractions);
        await route.fulfill({ json: { success: true } });
        socket!.send(JSON.stringify({ type: 'client_updated', client }));
      } else {
        await route.fulfill({ json: {} });
      }
    });
    await page.goto(url);
    const checkbox = page.getByRole('checkbox', { name: 'Disable tap controls', exact: true });
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect.poll(() => pushed).toEqual([true]);
    await expect(checkbox).toBeChecked();
    await checkbox.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${url === '/admin' ? 'admin' : 'screen'}-tap-controls.png`) });
    await checkbox.uncheck();
    await expect.poll(() => pushed).toEqual([true, false]);
    await expect(checkbox).not.toBeChecked();
  });
}
