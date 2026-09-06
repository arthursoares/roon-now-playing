import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';

async function openPlayingLayout(
  page: Page,
  layout: string,
  background?: string,
): Promise<WebSocketRoute> {
  let socket: WebSocketRoute;
  await page.routeWebSocket('**/ws**', (connection: WebSocketRoute) => {
    socket = connection;
    connection.onMessage((raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'client_metadata') {
        connection.send(JSON.stringify({
          type: 'connection', status: 'connected', roon_connected: false, roon_enabled: false,
        }));
        connection.send(JSON.stringify({
          type: 'zones', zones: [{ id: 'fixture', display_name: 'Listening room' }],
        }));
      } else if (message.type === 'subscribe') {
        connection.send(JSON.stringify({
          type: 'now_playing', zone_id: 'fixture', state: 'playing', seek_position: 25,
          track: {
            title: '15 Step', artist: 'Radiohead', album: 'In Rainbows',
            duration_seconds: 100, artwork_key: null,
          },
        }));
      }
    });
  });
  await page.route('**/api/facts/config', (route) => route.fulfill({
    json: { hasApiKey: true, rotationInterval: 30 },
  }));
  await page.route('**/api/facts', (route) => route.fulfill({
    json: { facts: ['A stable fixture fact.'], cached: true, generatedAt: '2026-09-06T00:00:00Z' },
  }));

  const params = new URLSearchParams({ layout, zone: 'fixture' });
  if (background) params.set('background', background);
  await page.goto(`/?${params}`);
  await expect(page.locator(`.${layout}-layout`)).toBeVisible();
  return socket!;
}

const progressScenarios = [
  { name: 'basic', layout: 'basic' },
  { name: 'minimal ordinary background', layout: 'minimal', background: 'black', dynamic: false },
  { name: 'minimal dynamic background', layout: 'minimal', background: 'gradient-mesh', dynamic: true },
  { name: 'facts-overlay', layout: 'facts-overlay' },
  { name: 'facts-carousel', layout: 'facts-carousel' },
];

for (const scenario of progressScenarios) {
  test(`${scenario.name} progress animates only its transform`, async ({ page }, testInfo) => {
    await openPlayingLayout(page, scenario.layout, scenario.background);
    if (scenario.dynamic === true) {
      await expect(page.locator('.minimal-layout.dynamic-background')).toBeVisible();
    } else if (scenario.dynamic === false) {
      await expect(page.locator('.minimal-layout:not(.dynamic-background) .artwork-background')).toBeVisible();
    }
    const fill = page.locator(`.${scenario.layout}-layout .progress-fill`);

    await expect(fill).toBeVisible();
    await expect.poll(() => fill.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: style.width,
        trackWidth: getComputedStyle(element.parentElement!).width,
        origin: style.transformOrigin,
        transitionProperty: style.transitionProperty,
        transform: style.transform,
      };
    })).toMatchObject({
      transitionProperty: 'transform',
      transform: expect.stringMatching(/^matrix\(0\.[2-4]/),
    });

    const geometry = await fill.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: parseFloat(style.width),
        trackWidth: parseFloat(getComputedStyle(element.parentElement!).width),
        originX: parseFloat(style.transformOrigin),
      };
    });
    expect(geometry.width).toBeCloseTo(geometry.trackWidth, 0);
    expect(geometry.originX).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`${scenario.name}-progress.png`), fullPage: true });
  });
}

test('progress follows pause, seek, resume, and track updates', async ({ page }) => {
  const socket = await openPlayingLayout(page, 'basic');
  const fill = page.locator('.basic-layout .progress-fill');

  socket.send(JSON.stringify({
    type: 'now_playing', zone_id: 'fixture', state: 'paused', seek_position: 60,
    track: {
      title: '15 Step', artist: 'Radiohead', album: 'In Rainbows',
      duration_seconds: 100, artwork_key: null,
    },
  }));
  await expect(fill).toHaveCSS('transform', 'matrix(0.6, 0, 0, 1, 0, 0)');
  await page.waitForTimeout(250);
  await expect(fill).toHaveCSS('transform', 'matrix(0.6, 0, 0, 1, 0, 0)');

  socket.send(JSON.stringify({
    type: 'now_playing', zone_id: 'fixture', state: 'paused', seek_position: 10,
    track: {
      title: '15 Step', artist: 'Radiohead', album: 'In Rainbows',
      duration_seconds: 100, artwork_key: null,
    },
  }));
  await expect(fill).toHaveCSS('transform', 'matrix(0.1, 0, 0, 1, 0, 0)');

  socket.send(JSON.stringify({
    type: 'now_playing', zone_id: 'fixture', state: 'playing', seek_position: 10,
    track: {
      title: '15 Step', artist: 'Radiohead', album: 'In Rainbows',
      duration_seconds: 100, artwork_key: null,
    },
  }));
  await expect.poll(async () => {
    const transform = await fill.evaluate((element) => getComputedStyle(element).transform);
    return Number(transform.match(/^matrix\(([^,]+)/)?.[1] ?? 0);
  }).toBeGreaterThan(0.101);

  socket.send(JSON.stringify({
    type: 'now_playing', zone_id: 'fixture', state: 'paused', seek_position: 5,
    track: {
      title: 'Bodysnatchers', artist: 'Radiohead', album: 'In Rainbows',
      duration_seconds: 100, artwork_key: null,
    },
  }));
  await expect(fill).toHaveCSS('transform', 'matrix(0.05, 0, 0, 1, 0, 0)');
});
