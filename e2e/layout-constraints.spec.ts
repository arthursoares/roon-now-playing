import { test, expect, type Page } from '@playwright/test';
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
 * Helper to select a zone if zone picker is shown
 */
async function selectZoneIfNeeded(page: Page): Promise<void> {
  // Check if zone picker is visible
  const zonePicker = page.locator('text=Select Zone');
  const isZonePickerVisible = await zonePicker.isVisible({ timeout: 2000 }).catch(() => false);

  if (isZonePickerVisible) {
    // Click the first available zone
    const firstZone = page.locator('li').first();
    await firstZone.click();
    // Wait for zone picker to disappear
    await zonePicker.waitFor({ state: 'hidden', timeout: 5000 });
  }
}

/**
 * Set up mock artwork route interception
 */
async function setupMockArtwork(page: Page): Promise<void> {
  // Read the artwork file
  const artworkBuffer = fs.readFileSync(TEST_ARTWORK_PATH);

  // Intercept artwork requests and serve our test image
  await page.route('**/artwork/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: artworkBuffer,
    });
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
  await page.request.post('http://localhost:3000/api/sources/test-spotify/now-playing', {
    data: {
      zone_name: 'Test Spotify Player',
      state: 'playing',
      title: '15 Step',
      artist: 'Radiohead',
      album: 'In Rainbows',
      duration_seconds: 237,
      seek_position: 45,
      artwork_url: 'http://localhost:3000/test-artwork.jpg',
    },
  });
  // Wait for WebSocket to propagate the update
  await page.waitForTimeout(500);
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

test.describe('Layout Column Height Constraints', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to facts-columns layout
    await page.goto('/?layout=facts-columns&background=black');

    // Handle zone selection
    await selectZoneIfNeeded(page);

    // Wait for layout to render
    await page.waitForSelector('.facts-columns-layout', { timeout: 10000 });
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

    await page.goto('/?layout=basic&background=black');

    // Handle zone selection
    await selectZoneIfNeeded(page);

    // Wait for layout to render
    await page.waitForSelector('.basic-layout', { timeout: 10000 });

    // Check for essential elements
    await expect(page.locator('.basic-layout')).toBeVisible();
    await expect(page.locator('.artwork-wrapper')).toBeVisible();

    // Verify no JS errors (filter out expected API errors like facts API)
    const criticalErrors = errors.filter(
      (e) => !e.includes('/api/facts') && !e.includes('503') && !e.includes('WebSocket')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should display artwork placeholder or image', async ({ page }) => {
    await page.goto('/?layout=basic&background=black');
    await selectZoneIfNeeded(page);
    await page.waitForSelector('.basic-layout', { timeout: 10000 });

    // Either artwork image or placeholder should be visible
    const hasArtwork = await page.locator('.artwork').isVisible().catch(() => false);
    const hasPlaceholder = await page.locator('.artwork-placeholder').isVisible().catch(() => false);

    expect(hasArtwork || hasPlaceholder).toBe(true);
  });
});

test.describe('Responsive Layout Behavior', () => {
  test('should switch to column layout on narrow viewports', async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 900) {
      test.skip();
      return;
    }

    await page.goto('/?layout=facts-columns&background=black');
    await selectZoneIfNeeded(page);
    await page.waitForSelector('.facts-columns-layout', { timeout: 10000 });

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

    await page.goto('/?layout=facts-columns&background=black');
    await selectZoneIfNeeded(page);
    await page.waitForSelector('.facts-columns-layout', { timeout: 10000 });

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
  const layouts = [
    'detailed',
    'minimal',
    'fullscreen',
    'ambient',
    'cover',
    'facts-columns',
    'facts-overlay',
    'facts-carousel',
    'basic',
  ];

  for (const layout of layouts) {
    test(`${layout} layout should render without critical errors`, async ({ page }) => {
      const errors: string[] = [];

      page.on('pageerror', (err) => {
        // Ignore SyntaxError for legacy bundles on modern browsers (expected)
        if (!err.message.includes('SyntaxError')) {
          errors.push(err.message);
        }
      });

      await page.goto(`/?layout=${layout}&background=black`);

      // Handle zone selection
      await selectZoneIfNeeded(page);

      // Wait for any layout to appear
      await page.waitForSelector('[class*="layout"]', { timeout: 10000 });

      // Should not have critical JS errors
      expect(errors).toHaveLength(0);
    });
  }
});

/**
 * Screenshot capture for visual validation in PRs
 * Run with: pnpm test:e2e --grep "Screenshot"
 */
test.describe('Screenshot Capture for PR Validation', () => {
  const layouts = [
    'detailed',
    'minimal',
    'fullscreen',
    'ambient',
    'cover',
    'facts-columns',
    'facts-overlay',
    'facts-carousel',
    'basic',
  ];

  const backgrounds = ['black', 'dominant', 'gradient-radial'];

  test.beforeAll(async () => {
    // Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  for (const layout of layouts) {
    test(`Screenshot: ${layout} layout`, async ({ page, viewport }, testInfo) => {
      const projectName = testInfo.project.name;
      const viewportName = viewport ? `${viewport.width}x${viewport.height}` : 'default';

      // Set up mock artwork route interception
      await setupMockArtwork(page);

      // Push mock playback data with artwork
      await pushMockPlayback(page);

      // For facts layouts, set up API mocking before navigation
      if (layout.startsWith('facts-')) {
        await setupMockFactsApi(page);
      }

      await page.goto(`/?layout=${layout}&background=black`);
      await selectZoneIfNeeded(page);

      // Wait for layout to stabilize
      await page.waitForSelector('[class*="layout"]', { timeout: 10000 });

      // For facts layouts, wait for facts to load and layout to stabilize
      if (layout.startsWith('facts-')) {
        await page.waitForSelector('.fact-text', { timeout: 5000 }).catch(() => {
          // Facts may not always load, continue anyway
        });
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
          if (!artwork || !facts) return { pass: true, reason: 'elements not found' };

          const artworkBottom = artwork.getBoundingClientRect().bottom;
          const factsBottom = facts.getBoundingClientRect().bottom;

          return {
            pass: factsBottom <= artworkBottom + 5, // 5px tolerance
            artworkBottom,
            factsBottom,
            difference: factsBottom - artworkBottom,
          };
        });

        if (!constraint.pass) {
          testInfo.annotations.push({
            type: 'warning',
            description: `Facts column extends ${constraint.difference}px beyond artwork`,
          });
        }
      }
    });
  }

  // Additional test: capture facts-columns with different backgrounds
  test('Screenshot: facts-columns with different backgrounds', async ({ page, viewport }, testInfo) => {
    const projectName = testInfo.project.name;
    const viewportName = viewport ? `${viewport.width}x${viewport.height}` : 'default';

    // Set up mock artwork route interception
    await setupMockArtwork(page);

    // Push mock playback data with artwork
    await pushMockPlayback(page);

    // Set up API mocking for facts
    await setupMockFactsApi(page);

    for (const bg of backgrounds) {
      await page.goto(`/?layout=facts-columns&background=${bg}`);
      await selectZoneIfNeeded(page);
      await page.waitForSelector('.facts-columns-layout', { timeout: 10000 });

      // Wait for facts to load
      await page.waitForSelector('.fact-text', { timeout: 5000 }).catch(() => {});
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
          if (!artwork || !facts) return { pass: true };

          const artworkBottom = artwork.getBoundingClientRect().bottom;
          const factsBottom = facts.getBoundingClientRect().bottom;

          return {
            pass: factsBottom <= artworkBottom + 5,
            difference: factsBottom - artworkBottom,
          };
        });

        if (!constraint.pass) {
          testInfo.annotations.push({
            type: 'warning',
            description: `[${bg}] Facts column extends ${constraint.difference}px beyond artwork`,
          });
        }
      }
    }
  });
});
