import { test, expect, type WebSocketRoute } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DISPLAY_SETTINGS } from '../packages/shared/src/index.ts';

for (const scenario of [
  { name: 'basic track', layout: 'basic', playing: true, selectors: ['.title', '.artist', '.album', '.time-display'] },
  { name: 'basic idle', layout: 'basic', playing: false, selectors: ['.no-playback', '.zone-hint'] },
  { name: 'fullscreen idle', layout: 'fullscreen', playing: false, selectors: ['.artwork-placeholder p'] },
]) {
  test(`${scenario.name} follows global scale and per-display overrides exactly once`, async ({ page }, testInfo) => {
    let socket: WebSocketRoute;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.routeWebSocket('**/ws**', (connection) => {
      socket = connection;
      connection.onMessage((raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === 'client_metadata') {
          connection.send(JSON.stringify({ type: 'connection', status: 'connected', roon_connected: false, roon_enabled: false }));
          connection.send(JSON.stringify({ type: 'zones', zones: [{ id: 'fixture', display_name: 'Listening room' }] }));
        } else if (message.type === 'subscribe') {
          connection.send(JSON.stringify({ type: 'now_playing', zone_id: 'fixture',
            state: scenario.playing ? 'playing' : 'stopped', seek_position: 42,
            track: scenario.playing ? {
              title: '15 Step', artist: 'Radiohead', album: 'In Rainbows', duration_seconds: 237, artwork_key: 'fixture',
            } : null,
          }));
        }
      });
    });
    await page.route('**/api/artwork/fixture', (route) => route.fulfill({
      contentType: 'image/jpeg', body: fs.readFileSync(path.join(process.cwd(), 'assets/artwork_radiohead-in_rainbows.jpg')),
    }));
    await page.goto(`/?layout=${scenario.layout}&zone=fixture`);
    const root = page.locator(`.${scenario.layout}-layout`);
    await expect(root).toBeVisible();
    const nodes = scenario.selectors.map((selector) => root.locator(selector));
    for (const node of nodes) await expect(node).toBeVisible();
    const baseline = await Promise.all(nodes.map((node) => node.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))));
    async function expectScale(scale: number) {
      for (const [index, node] of nodes.entries()) {
        await expect.poll(async () => parseFloat(await node.evaluate((el) => getComputedStyle(el).fontSize)))
          .toBeCloseTo(baseline[index] * scale, 1);
      }
    }
    function globalScale(fontScale: number) {
      socket!.send(JSON.stringify({ type: 'display_settings_update', settings: { ...DEFAULT_DISPLAY_SETTINGS, fontScale } }));
    }
    globalScale(0.75);
    await expectScale(0.75);
    socket!.send(JSON.stringify({ type: 'remote_settings', fontScaleOverride: 1.5 }));
    await expectScale(1.5);
    await page.screenshot({ path: testInfo.outputPath(`${scenario.layout}-${scenario.playing ? 'track' : 'idle'}-150.png`), fullPage: true });
    globalScale(0.8);
    await expectScale(1.5);
    socket!.send(JSON.stringify({ type: 'remote_settings', fontScaleOverride: null }));
    await expectScale(0.8);
    expect(errors).toEqual([]);
  });
}
