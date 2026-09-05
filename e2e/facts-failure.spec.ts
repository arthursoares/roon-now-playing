import { test, expect, type WebSocketRoute } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

for (const layout of ['facts-columns', 'facts-overlay', 'facts-carousel']) {
  for (const status of [200, 502]) {
    test(`${layout} keeps rendering after an HTTP-${status} facts error and recovers on the next track`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let socket: WebSocketRoute;
      let failed = true;
      const track = {
        title: '15 Step', artist: 'Radiohead', album: 'In Rainbows', duration_seconds: 237, artwork_key: 'fixture',
      };
      await page.routeWebSocket('**/ws**', (connection) => {
        socket = connection;
        connection.onMessage((message) => {
          const data = JSON.parse(message.toString());
          if (data.type === 'client_metadata') {
            connection.send(JSON.stringify({ type: 'connection', status: 'connected', roon_connected: false, roon_enabled: false }));
            connection.send(JSON.stringify({ type: 'zones', zones: [{ id: 'fixture', display_name: 'Listening room' }] }));
          } else if (data.type === 'subscribe') {
            connection.send(JSON.stringify({ type: 'now_playing', zone_id: 'fixture', state: 'playing', track, seek_position: 42 }));
          }
        });
      });
      await page.route('**/api/facts/config', (route) => route.fulfill({ json: { hasApiKey: true, rotationInterval: 25 } }));
      await page.route('**/api/artwork/fixture', (route) => route.fulfill({
        contentType: 'image/jpeg', body: fs.readFileSync(path.join(process.cwd(), 'assets/artwork_radiohead-in_rainbows.jpg')),
      }));
      await page.route('**/api/facts', (route) => route.fulfill({
        status: failed ? status : 200,
        json: failed
          ? { error: { type: 'empty', message: 'No usable facts could be generated. Please try again.' } }
          : { facts: ['A successfully recovered fact for the next track.'], cached: false, generatedAt: Date.now() },
      }));

      await page.goto(`/?layout=${layout}&zone=fixture`);
      const root = page.locator(`.${layout}-layout`);
      await expect(root).toBeVisible();
      await expect(page.getByRole('status')).toContainText('No usable facts could be generated');
      await expect(root.getByText('15 Step', { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
      if (status === 502) {
        await page.screenshot({ path: testInfo.outputPath(`${layout}-error.png`), fullPage: true });
      }
      failed = false;
      socket!.send(JSON.stringify({ type: 'now_playing', zone_id: 'fixture', state: 'playing',
        track: { ...track, title: 'Bodysnatchers' }, seek_position: 0 }));
      await expect(page.locator('.fact-text')).toContainText('A successfully recovered fact for the next track.');
      await expect(page.getByRole('status')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}
