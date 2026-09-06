import { expect, test, type Page } from '@playwright/test';

const layouts = ['facts-columns', 'facts-overlay', 'facts-carousel'] as const;

async function mockDisplay(page: Page): Promise<void> {
  await page.routeWebSocket('**/ws**', (connection) => {
    connection.onMessage((message) => {
      const data = JSON.parse(message.toString());
      if (data.type === 'client_metadata') {
        connection.send(JSON.stringify({
          type: 'connection', status: 'connected', roon_connected: false, roon_enabled: false,
        }));
        connection.send(JSON.stringify({
          type: 'zones', zones: [{ id: 'fixture', display_name: 'Listening room' }],
        }));
      } else if (data.type === 'subscribe') {
        connection.send(JSON.stringify({
          type: 'now_playing',
          zone_id: 'fixture',
          state: 'playing',
          seek_position: 42,
          track: {
            title: 'Blue in Green',
            artist: 'Miles Davis',
            album: 'Kind of Blue',
            duration_seconds: 337,
            artwork_key: null,
          },
        }));
      }
    });
  });

  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/facts/config') {
      return route.fulfill({ json: { hasApiKey: true, rotationInterval: 120 } });
    }
    if (pathname === '/api/facts') {
      return route.fulfill({
        json: {
          facts: [
            'The modal harmony and restrained arrangement leave space for every instrumental phrase.',
            ' ',
            'A second fact that should not rotate into view during this test.',
          ],
          sources: [
            [
              { url: 'https://www.britannica.com/biography/Miles-Davis', title: 'Encyclopaedia Britannica' },
              { url: 'https://musicbrainz.org/release/example', title: 'MusicBrainz' },
            ],
            [{ url: 'https://example.com/wrong', title: 'Wrong blank-fact source' }],
            [{ url: 'https://www.discogs.com/release/example', title: 'Discogs' }],
          ],
          cached: false,
          generatedAt: 1,
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' } });
  });
}

test('fact attribution stays aligned and contained in every facts layout', async ({ page }, testInfo) => {
  await mockDisplay(page);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  for (const layout of layouts) {
    await page.goto(`/?layout=${layout}&zone=fixture`);

    const root = page.locator(`.${layout}-layout`);
    await expect(root).toBeVisible();
    await expect(root.locator('.fact-text')).toContainText('The modal harmony');

    const sources = root.getByRole('navigation', { name: 'Sources' });
    await expect(sources).toBeVisible();
    await expect(sources.getByRole('link')).toHaveText(['Encyclopaedia Britannica', 'MusicBrainz']);
    await expect(root.getByText('Wrong blank-fact source')).toHaveCount(0);

    const bounds = await sources.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height + 1);

    const documentOverflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(documentOverflow.horizontal).toBeLessThanOrEqual(1);
    expect(documentOverflow.vertical).toBeLessThanOrEqual(1);

    await page.screenshot({ path: testInfo.outputPath(`${layout}.png`), fullPage: true });
  }
});
