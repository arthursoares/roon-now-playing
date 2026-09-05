import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const serverUrl = process.env.E2E_SERVER_URL ?? 'http://localhost:3000';

async function seedAlbums(page: Page, zone: string, count = 12) {
  await expect.poll(async () => {
    try { return (await page.request.get(`${serverUrl}/api/health`)).status(); }
    catch { return 0; }
  }).toBe(200);

  const covers = await page.evaluate((length) => Array.from({ length }, (_, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 400;
    const context = canvas.getContext('2d')!;
    context.fillStyle = `hsl(${i * 31}, 35%, 26%)`;
    context.fillRect(0, 0, 400, 400);
    context.fillStyle = `hsl(${i * 31 + 35}, 70%, 66%)`;
    context.beginPath();
    context.arc(130 + i * 8, 145, 100 + i * 3, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff';
    context.font = '24px sans-serif';
    context.fillText('LISTENING ROOM', 28, 315);
    context.font = 'bold 36px sans-serif';
    context.fillText(`VOL. ${String(i + 1).padStart(2, '0')}`, 28, 365);
    return canvas.toDataURL('image/jpeg');
  }), count);

  for (let i = 0; i < count; i++) {
    const response = await page.request.post(`${serverUrl}/api/sources/${zone}/now-playing`, {
      data: {
        zone_name: 'Listening room', state: 'playing', title: 'A Place Between the Notes',
        artist: `The Session ${i + 1}`, album: `Evening Studies ${i + 1}`,
        duration_seconds: 240, seek_position: 62, artwork_url: covers[i],
      },
    });
    expect(response.ok()).toBe(true);
  }
}

test('Album Wall retains and displays the complete zone history after reload', async ({ page }, testInfo) => {
  const zone = `wall-${randomUUID()}`;
  await seedAlbums(page, zone);
  const url = `/?layout=album-wall&zone=${zone}`;
  await page.goto(url);
  await expect(page.locator('.album-wall-layout')).toBeVisible();
  await expect(page.locator('.album-card')).toHaveCount(11);
  await expect(page.locator('.hero h1')).toHaveText('A Place Between the Notes');
  await expect(page.locator('.album-name').first()).toHaveText('Evening Studies 11');
  await expect(page.locator('.album-name').last()).toHaveText('Evening Studies 1');
  await expect.poll(() => page.locator('.album-wall-layout img').evaluateAll((images) =>
    images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
  )).toBe(true);

  await page.reload();
  await expect(page.locator('.album-card')).toHaveCount(11);
  await expect(page.locator('.hero .album')).toHaveText('Evening Studies 12');
  for (const scale of [1, 1.5]) {
    await page.evaluate((value) => document.documentElement.style.setProperty('--font-scale', String(value)), scale);
    await expect.poll(() => page.locator('.album-grid').evaluate((grid) => {
      const cards = [...grid.querySelectorAll('.album-card')];
      return cards.every((card) => {
        const bounds = card.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.bottom <= innerHeight + 1;
      });
    }), { message: `All recent albums should fit at font scale ${scale}` }).toBe(true);
  }
  await page.evaluate(() => document.documentElement.style.setProperty('--font-scale', '1'));
  await expect.poll(() => page.locator('.album-card').evaluateAll((cards) =>
    cards.every((card) => getComputedStyle(card).opacity === '1'),
  )).toBe(true);

  const directory = path.join('e2e/screenshots/album-wall', testInfo.project.name);
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, 'history.jpg'), type: 'jpeg', quality: 85, animations: 'disabled' });
});

test('Album Wall clears history on zone changes and renders missing artwork', async ({ page }) => {
  const first = `wall-${randomUUID()}`;
  const second = `wall-${randomUUID()}`;
  await seedAlbums(page, first, 3);
  const response = await page.request.post(`${serverUrl}/api/sources/${second}/now-playing`, {
    data: { zone_name: 'Other room', state: 'playing', title: 'No cover yet', artist: 'New artist', album: 'New album' },
  });
  expect(response.ok()).toBe(true);
  await page.goto(`/?layout=album-wall&zone=${first}`);
  await expect(page.locator('.album-card')).toHaveCount(2);
  await page.goto(`/?layout=album-wall&zone=${second}`);
  await expect(page.locator('.hero h1')).toHaveText('No cover yet');
  await expect(page.locator('.album-card')).toHaveCount(0);
  await expect(page.locator('.hero-placeholder')).toBeVisible();
  await expect(page.locator('.empty-history')).toBeVisible();
});

async function expectCoverMosaic(page: Page) {
  await expect.poll(() => page.locator('.gallery-card').evaluateAll((cards) => {
    let coveredArea = 0;
    const squareTiles = cards.every((card) => {
      const frame = card.querySelector('.album-cover-frame')!.getBoundingClientRect();
      const image = card.querySelector('img');
      const visibleWidth = Math.max(0, Math.min(frame.right, innerWidth) - Math.max(frame.left, 0));
      const visibleHeight = Math.max(0, Math.min(frame.bottom, innerHeight) - Math.max(frame.top, 0));
      coveredArea += visibleWidth * visibleHeight;
      return Math.abs(frame.width - frame.height) <= 1 && frame.width > 15 &&
        image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 &&
        getComputedStyle(image).objectFit === 'contain';
    });
    return squareTiles && Math.abs(coveredArea - innerWidth * innerHeight) < innerWidth * innerHeight * 0.001;
  }), { message: 'Square, uncropped tiles should cover every viewport pixel; only screen edges may clip them' }).toBe(true);
}

test('Album Gallery fills the viewport with covers only and clips only at screen edges', async ({ page }, testInfo) => {
  const zone = `gallery-${randomUUID()}`;
  await seedAlbums(page, zone);
  await page.goto(`/?layout=album-gallery&zone=${zone}`);
  const gallery = page.locator('.album-gallery-layout');
  await expect(gallery).toBeVisible();
  await expect(page.locator('.gallery-card')).toHaveCount(40);
  await expect(page.locator('.gallery-card:not([aria-hidden="true"])')).toHaveCount(12);
  await expect(page.locator('.hero, .gallery-header, .album-copy, .current-marker')).toHaveCount(0);
  expect((await gallery.innerText()).trim()).toBe('');
  await expect(page.locator('.gallery-card').first()).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.gallery-card').first().locator('img')).toHaveAttribute('alt', 'Evening Studies 12 by The Session 12');
  await expectCoverMosaic(page);
  const directory = path.join('e2e/screenshots/album-gallery', testInfo.project.name);
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, 'gallery.jpg'), type: 'jpeg', quality: 85, animations: 'disabled' });
});

test('Album Gallery fills the screen with incomplete history and on landscape phones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'TV-1080p', 'This regression supplies its own viewport sizes');
  for (const count of [1, 3, 5, 11, 12]) {
    const zone = `partial-gallery-${randomUUID()}`;
    await seedAlbums(page, zone, count);
    await page.goto(`/?layout=album-gallery&zone=${zone}`);
    await expect(page.locator('.gallery-card')).toHaveCount(40);
    await expect(page.locator('.gallery-card:not([aria-hidden="true"])')).toHaveCount(count);
    await expectCoverMosaic(page);
  }
  for (const viewport of [{ width: 600, height: 400 }, { width: 568, height: 320 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expectCoverMosaic(page);
  }
});
