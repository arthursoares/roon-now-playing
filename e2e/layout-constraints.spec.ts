import { test, expect, type Page } from '@playwright/test';
import {
  BACKGROUNDS,
  LAYOUTS,
  type BackgroundType,
  type LayoutType,
} from '../packages/shared/src/index.ts';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Screenshot output directory
const SCREENSHOT_DIR = 'e2e/screenshots';

// Test artwork path
const TEST_ARTWORK_PATH = path.join(__dirname, '..', 'assets', 'artwork_radiohead-in_rainbows.jpg');
const TEST_ZONE_NAME = 'Test Spotify Player';
const artworkRequestCounts = new WeakMap<Page, number>();

/**
 * Test Plan: Layout Column Height Constraints
 *
 * Scenario: Facts/two-column layouts should constrain second column to artwork height
 *   Given a layout with artwork and facts columns (facts-columns, facts-overlay)
 *   When the viewport is in landscape/desktop mode (width >= 900px)
 *   Then the facts column height should not exceed the artwork height
 *   And overflow content should be properly contained
 *
 * Scenario: Basic layout should render without errors
 *   Given the basic layout for legacy browsers
 *   When loaded on any viewport size
 *   Then it should render without JavaScript errors
 *   And display the expected elements
 */

// Test viewports are defined in playwright.config.ts

/**
 * Set up mock artwork route interception
 */
async function setupMockArtwork(page: Page): Promise<void> {
  // Read the artwork file
  const artworkBuffer = fs.readFileSync(TEST_ARTWORK_PATH);

  // Intercept artwork requests and serve our test image
  artworkRequestCounts.set(page, 0);
  await page.route('**/artwork/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: artworkBuffer,
    });
    artworkRequestCounts.set(page, (artworkRequestCounts.get(page) ?? 0) + 1);
  });

  // Also intercept direct URL requests for artwork
  await page.route('**/test-artwork.jpg', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: artworkBuffer,
    });
  });
}

/**
 * Push mock playback data to the test zone with artwork
 */
async function pushMockPlayback(page: Page): Promise<void> {
  // Embed the bundled cover as a data: URL so the SERVER can resolve it without
  // needing an HTTP route. The server's cacheExternalArtwork does fetch(url) and
  // returns null on failure; in CI there is no /test-artwork.jpg route, so an
  // http:// URL would 404 → artwork_key null → the client (which only renders
  // /api/artwork/<key>) shows a placeholder. A data: URL fetch succeeds and
  // caches the real bytes, giving a non-null key and real artwork in the matrix.
  const artworkDataUrl = `data:image/jpeg;base64,${fs.readFileSync(TEST_ARTWORK_PATH).toString('base64')}`;
  await expect.poll(async () => {
    try {
      const response = await page.request.post(
        'http://localhost:3000/api/sources/test-spotify/now-playing',
        {
          data: {
            zone_name: TEST_ZONE_NAME,
            state: 'playing',
            title: '15 Step',
            artist: 'Radiohead',
            album: 'In Rainbows',
            duration_seconds: 237,
            seek_position: 45,
            artwork_url: artworkDataUrl,
          },
        },
      );
      return response.status();
    } catch {
      return 0;
    }
  }, {
    message: 'server should accept deterministic mock playback',
    timeout: 10_000,
  }).toBe(200);
}

/**
 * Mock facts data for testing
 */
const MOCK_FACTS = [
  "In Rainbows was released in 2007 with a revolutionary 'pay what you want' model, allowing fans to download the album for any price they chose, including free.",
  "The album was recorded over two years at Radiohead's own studio in Oxfordshire, marking the band's first fully self-produced record.",
  "15 Step features an unusual 5/4 time signature, with children's voices recorded at a school near the studio adding to its distinctive sound.",
];

/**
 * Set up route interception for facts API to return mock data
 */
async function setupMockFactsApi(page: Page): Promise<void> {
  // Mock the facts config endpoint (indicates API is configured)
  await page.route('**/api/facts/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hasApiKey: true,
        rotationInterval: 30,
      }),
    });
  });

  // Mock the facts endpoint
  await page.route('**/api/facts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facts: MOCK_FACTS,
        cached: false,
        generatedAt: new Date().toISOString(),
      }),
    });
  });
}

function fixtureUrl(layout: LayoutType, background: BackgroundType): string {
  const params = new URLSearchParams({ layout, background, zone: TEST_ZONE_NAME });
  return `/?${params}`;
}

async function expectFixture(page: Page, layout: LayoutType): Promise<void> {
  const layoutRoot = page.locator(`.${layout}-layout`);
  await expect(layoutRoot).toBeVisible({ timeout: 10_000 });

  const artwork = layoutRoot.locator('img.artwork, img.bg-artwork, img.artwork-bg').last();
  const gradient = layoutRoot.locator('.gradient-layer');
  if (layout === 'minimal' && await gradient.count()) {
    await expect(gradient).toBeVisible();
    await expect.poll(() => gradient.evaluate((element) => getComputedStyle(element).backgroundImage)).not.toBe('none');
    await expect.poll(() => artworkRequestCounts.get(page) ?? 0).toBeGreaterThan(0);
  } else {
    await expect(artwork).toBeVisible();
    await expect.poll(
      () => artwork.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
      { message: `${layout} should decode the fixture artwork` },
    ).toBe(true);
  }

  if (layout.startsWith('facts-')) {
    await expect(layoutRoot.locator('.fact-text').first()).toContainText(MOCK_FACTS[0]);
  }
}

test.beforeEach(async ({ page }) => {
  await setupMockArtwork(page);
  await setupMockFactsApi(page);
  await pushMockPlayback(page);
});

test.describe('Layout Column Height Constraints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(fixtureUrl('facts-columns', 'black'));
    await expectFixture(page, 'facts-columns');
  });

  test('facts column should not exceed artwork height in desktop view', async ({ page, viewport }) => {
    // Skip for portrait/narrow viewports where layout is stacked
    if (!viewport || viewport.width < 900) {
      test.skip();
      return;
    }

    // Get element dimensions
    const dimensions = await page.evaluate(() => {
      const artworkWrapper = document.querySelector('.artwork-wrapper');
      const factsColumn = document.querySelector('.facts-column');

      if (!artworkWrapper || !factsColumn) {
        return { error: 'Elements not found' };
      }

      const artworkRect = artworkWrapper.getBoundingClientRect();
      const factsRect = factsColumn.getBoundingClientRect();

      return {
        artworkHeight: artworkRect.height,
        factsHeight: factsRect.height,
        factsInlineHeight: factsColumn.getAttribute('style'),
      };
    });

    // Verify elements were found
    expect(dimensions).not.toHaveProperty('error');

    // Allow 1px tolerance for rounding
    expect(dimensions.factsHeight).toBeLessThanOrEqual(dimensions.artworkHeight + 1);
  });

  test('overflow content should be contained within column bounds', async ({ page, viewport }) => {
    // Skip for portrait/narrow viewports
    if (!viewport || viewport.width < 900) {
      test.skip();
      return;
    }

    // Inject long content to test overflow
    await page.evaluate(() => {
      const factText = document.querySelector('.fact-text, .error-message, .no-playback-text');
      if (factText) {
        (factText as HTMLElement).textContent = 'This is a very long fact that repeats. '.repeat(50);
      }
    });

    // Wait for reflow
    await page.waitForTimeout(100);

    // Measure overflow
    const overflow = await page.evaluate(() => {
      const factsColumn = document.querySelector('.facts-column');
      const artworkWrapper = document.querySelector('.artwork-wrapper');

      if (!factsColumn || !artworkWrapper) {
        return { error: 'Elements not found' };
      }

      return {
        factsHeight: factsColumn.getBoundingClientRect().height,
        factsScrollHeight: factsColumn.scrollHeight,
        artworkHeight: artworkWrapper.getBoundingClientRect().height,
        hasOverflow: factsColumn.scrollHeight > factsColumn.clientHeight,
      };
    });

    expect(overflow).not.toHaveProperty('error');

    // Column height should still respect artwork constraint
    expect(overflow.factsHeight).toBeLessThanOrEqual(overflow.artworkHeight + 1);
  });
});

test.describe('Basic Layout Rendering', () => {
  test('should render without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];

    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });

    // Collect page errors
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto(fixtureUrl('basic', 'black'));
    await expectFixture(page, 'basic');

    // Check for essential elements
    await expect(page.locator('.basic-layout')).toBeVisible();
    await expect(page.locator('.artwork-wrapper')).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('should display the fixture artwork', async ({ page }) => {
    await page.goto(fixtureUrl('basic', 'black'));
    await expectFixture(page, 'basic');
  });
});

test.describe('Responsive Layout Behavior', () => {
  test('should switch to column layout on narrow viewports', async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 900) {
      test.skip();
      return;
    }

    await page.goto(fixtureUrl('facts-columns', 'black'));
    await expectFixture(page, 'facts-columns');

    // In narrow view, content should be stacked (flex-direction: column)
    const direction = await page.evaluate(() => {
      const content = document.querySelector('.content');
      if (!content) return null;
      return window.getComputedStyle(content).flexDirection;
    });

    expect(direction).toBe('column');
  });

  test('should use row layout on wide viewports', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 900) {
      test.skip();
      return;
    }

    await page.goto(fixtureUrl('facts-columns', 'black'));
    await expectFixture(page, 'facts-columns');

    // In wide view, content should be side-by-side (flex-direction: row)
    const direction = await page.evaluate(() => {
      const content = document.querySelector('.content');
      if (!content) return null;
      return window.getComputedStyle(content).flexDirection;
    });

    expect(direction).toBe('row');
  });
});

test.describe('All Layouts Smoke Test', () => {
  for (const layout of LAYOUTS) {
    test(`${layout} layout should render without critical errors`, async ({ page }) => {
      const errors: string[] = [];

      page.on('pageerror', (err) => {
        errors.push(err.message);
      });

      await page.goto(fixtureUrl(layout, 'black'));
      await expectFixture(page, layout);

      expect(errors).toHaveLength(0);
    });
  }
});

/**
 * Screenshot capture for visual validation in PRs
 * Run with: pnpm test:e2e --grep "Screenshot"
 */
test.describe('Screenshot Capture for PR Validation', () => {
  const backgrounds: BackgroundType[] = ['black', 'dominant', 'gradient-radial'];

  test.beforeAll(async () => {
    // Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  for (const layout of LAYOUTS) {
    test(`Screenshot: ${layout} layout`, async ({ page, viewport }, testInfo) => {
      const projectName = testInfo.project.name;
      const viewportName = viewport ? `${viewport.width}x${viewport.height}` : 'default';

      await page.goto(fixtureUrl(layout, 'black'));
      await expectFixture(page, layout);

      // For facts layouts, wait for facts to load and layout to stabilize
      if (layout.startsWith('facts-')) {
        // Wait for layout recalculation (ResizeObserver, updateLayout)
        await page.waitForTimeout(500);
      }

      await page.waitForTimeout(500); // Allow animations to settle

      // Capture screenshot
      const screenshotPath = path.join(
        SCREENSHOT_DIR,
        projectName,
        `${layout}-${viewportName}.png`
      );

      // Ensure project subdirectory exists
      const projectDir = path.join(SCREENSHOT_DIR, projectName);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
      });

      // Attach to test report
      await testInfo.attach(`${layout}-${projectName}`, {
        path: screenshotPath,
        contentType: 'image/png',
      });

      // For facts-columns layout, verify the column constraint
      if (layout === 'facts-columns' && viewport && viewport.width >= 900) {
        const constraint = await page.evaluate(() => {
          const artwork = document.querySelector('.artwork-wrapper');
          const facts = document.querySelector('.facts-column');
          if (!artwork || !facts) return null;

          const artworkBottom = artwork.getBoundingClientRect().bottom;
          const factsBottom = facts.getBoundingClientRect().bottom;

          return {
            pass: factsBottom <= artworkBottom + 5, // 5px tolerance
            artworkBottom,
            factsBottom,
            difference: factsBottom - artworkBottom,
          };
        });

        expect(constraint, 'facts layout constraint elements should exist').not.toBeNull();
        expect(constraint?.pass, `facts column extends ${constraint?.difference}px beyond artwork`).toBe(true);
      }
    });
  }

  // Additional test: capture facts-columns with different backgrounds
  test('Screenshot: facts-columns with different backgrounds', async ({ page, viewport }, testInfo) => {
    const projectName = testInfo.project.name;
    const viewportName = viewport ? `${viewport.width}x${viewport.height}` : 'default';

    for (const bg of backgrounds) {
      await page.goto(fixtureUrl('facts-columns', bg));
      await expectFixture(page, 'facts-columns');
      await page.waitForTimeout(500);

      const screenshotPath = path.join(
        SCREENSHOT_DIR,
        projectName,
        `facts-columns-bg-${bg}-${viewportName}.png`
      );

      const projectDir = path.join(SCREENSHOT_DIR, projectName);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
      });

      await testInfo.attach(`facts-columns-${bg}-${projectName}`, {
        path: screenshotPath,
        contentType: 'image/png',
      });

      // Check column constraint
      if (viewport && viewport.width >= 900) {
        const constraint = await page.evaluate(() => {
          const artwork = document.querySelector('.artwork-wrapper');
          const facts = document.querySelector('.facts-column');
          if (!artwork || !facts) return null;

          const artworkBottom = artwork.getBoundingClientRect().bottom;
          const factsBottom = facts.getBoundingClientRect().bottom;

          return {
            pass: factsBottom <= artworkBottom + 5,
            difference: factsBottom - artworkBottom,
          };
        });

        expect(constraint, 'facts layout constraint elements should exist').not.toBeNull();
        expect(constraint?.pass, `[${bg}] facts column extends ${constraint?.difference}px beyond artwork`).toBe(true);
      }
    }
  });
});

/**
 * Approval Matrix — every cover style × every background type.
 *
 * This is the per-PR visual approval surface. It renders the full cross-product
 * of layouts and backgrounds and attaches each frame to the Playwright HTML
 * report. Run only at the approved review resolutions:
 *   - iPad-landscape (1194×834)
 *   - TV-1080p (1920×1080)
 *   - TV-4K (3840×2160)
 *
 * Run locally:   pnpm test:e2e:matrix   →   npx playwright show-report
 * In CI:         the "Visual Approval Matrix" workflow uploads the report as a
 *                downloadable artifact on every pull request.
 */
test.describe('Matrix', () => {
  // Selective runs: set MATRIX_LAYOUTS=detailed,basic to render only those layouts
  // (CI derives this from the layouts a PR actually changed). Empty → full matrix.
  const requested = (process.env.MATRIX_LAYOUTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const layouts = requested.length
    ? LAYOUTS.filter((layout) => requested.includes(layout))
    : LAYOUTS;

  for (const layout of layouts) {
    for (const background of BACKGROUNDS) {
      test(`Matrix: ${layout} / ${background}`, async ({ page }, testInfo) => {
        const projectName = testInfo.project.name;

        await page.goto(fixtureUrl(layout, background));
        await expectFixture(page, layout);
        await page.waitForTimeout(600); // let gradients + animations settle

        const dir = path.join(SCREENSHOT_DIR, 'matrix', projectName);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // JPEG (not PNG) keeps the artifact ~10x smaller for photographic
        // artwork/gradients. Frames are not attached to the HTML report (the
        // contact-sheet montages / gallery are the review surface) to avoid
        // duplicating every image into a multi-hundred-MB report.
        const file = path.join(dir, `${layout}__${background}.jpg`);
        await page.screenshot({ path: file, type: 'jpeg', quality: 80, fullPage: false });
      });
    }
  }
});
