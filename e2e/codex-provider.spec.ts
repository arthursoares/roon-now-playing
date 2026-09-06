import { expect, test, type Page } from '@playwright/test';
import type { CodexAccountStatus, FactsConfig } from '../packages/shared/src/index.ts';

const ADMIN_TOKEN = 'fixture-codex-admin-token-1234567890';

const signedIn: CodexAccountStatus = {
  state: 'signed-in',
  account: { email: 'researcher@example.com', planType: 'Plus' },
  login: null,
  error: null,
  generationEnabled: true,
};

interface RecordedRequest {
  method: string;
  path: string;
  token: string | null;
  body: unknown;
}

interface ProviderFixture {
  requests: RecordedRequest[];
}

async function installProviderFixture(
  page: Page,
  options: { generationEnabled?: boolean; provider?: FactsConfig['provider'] } = {},
): Promise<ProviderFixture> {
  const generationEnabled = options.generationEnabled ?? true;
  let config: FactsConfig = {
    provider: options.provider ?? 'anthropic',
    model: 'claude-haiku-4-5',
    apiKey: 'retained-provider-api-key',
    factsCount: 5,
    rotationInterval: 25,
    prompt: 'Facts about {title}',
    maxOutputTokens: 4096,
  };
  const requests: RecordedRequest[] = [];

  await page.routeWebSocket('**/ws**', (connection) => {
    connection.onMessage(() => {
      connection.send(JSON.stringify({
        type: 'connection', status: 'connected', roon_connected: false, roon_enabled: false,
      }));
      connection.send(JSON.stringify({ type: 'clients_list', clients: [] }));
      connection.send(JSON.stringify({ type: 'zones', zones: [] }));
    });
  });

  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() ? request.postDataJSON() : null;
    const token = request.headers().authorization?.replace(/^Bearer /, '') ?? null;
    requests.push({ method: request.method(), path, token, body });

    if (path === '/api/codex/capabilities') {
      await route.fulfill({ json: { enabled: true, generationEnabled } });
      return;
    }
    if (path === '/api/codex/account') {
      await route.fulfill({ json: signedIn });
      return;
    }
    if (path === '/api/facts/config' && request.method() === 'GET') {
      await route.fulfill({ json: config });
      return;
    }
    if (path === '/api/facts/config' && request.method() === 'POST') {
      if (token !== ADMIN_TOKEN) {
        await route.fulfill({ status: 401, json: { error: 'unauthorized', message: 'Dedicated token required' } });
        return;
      }
      config = { ...config, ...(body as Partial<FactsConfig>) };
      await route.fulfill({ json: config });
      return;
    }
    if (path === '/api/facts/test') {
      if (token !== ADMIN_TOKEN) {
        await route.fulfill({ status: 401, json: { error: 'unauthorized', message: 'Dedicated token required' } });
        return;
      }
      await route.fulfill({
        json: {
          facts: [
            'The session captured a fresh web-researched fact.',
            'Its second result carries a separate source.',
          ],
          sources: [
            [{ url: 'https://www.britannica.com/biography/Miles-Davis', title: 'Encyclopaedia Britannica' }],
            [{ url: 'https://musicbrainz.org/artist/example', title: 'MusicBrainz' }],
          ],
          durationMs: 1500,
          research: { cache: 'miss', webSearches: 3, openPages: 4, durationMs: 1450 },
        },
      });
      return;
    }
    if (path === '/api/sources/config') {
      await route.fulfill({ json: { requireApiKey: false, hasApiKey: false, apiKey: '' } });
      return;
    }
    if (path === '/api/sources') {
      await route.fulfill({ json: { zones: [] } });
      return;
    }
    if (path === '/api/admin/display-settings') {
      await route.fulfill({ json: { fontScale: 1, artworkScale: 100 } });
      return;
    }

    await route.fulfill({ status: 404, json: { error: `Unexpected fixture request: ${path}` } });
  });

  return { requests };
}

async function openFacts(page: Page): Promise<void> {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'AI Facts' }).click();
  await expect(page.getByRole('heading', { name: 'AI Facts Configuration' })).toBeVisible();
  await expect(page.locator('#provider')).toBeVisible();
}

async function unlock(page: Page): Promise<void> {
  await page.getByLabel('Admin token').fill(ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Unlock account controls' }).click();
  await expect(page.getByText('researcher@example.com')).toBeVisible();
}

function requestsFor(fixture: ProviderFixture, path: string, method = 'POST'): RecordedRequest[] {
  return fixture.requests.filter((request) => request.path === path && request.method === method);
}

test('unlocked Codex provider saves, researches, switches back, and forgets authorization', async ({ page }, testInfo) => {
  const fixture = await installProviderFixture(page);
  await openFacts(page);

  await expect(page.locator('#provider option[value="codex"]')).toHaveText('ChatGPT (Codex)');
  await unlock(page);
  await page.locator('#provider').selectOption('codex');
  await expect(page.locator('#apiKey')).toHaveCount(0);
  await page.getByRole('button', { name: 'Advanced Settings' }).click();
  await expect(page.locator('#maxOutputTokens')).toHaveCount(0);

  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect.poll(() => requestsFor(fixture, '/api/facts/config').length).toBe(1);
  const codexSave = requestsFor(fixture, '/api/facts/config')[0]!;
  expect(codexSave.token).toBe(ADMIN_TOKEN);
  expect(codexSave.body).toMatchObject({
    provider: 'codex', apiKey: 'retained-provider-api-key', maxOutputTokens: 4096,
  });

  await page.getByRole('button', { name: 'Test', exact: true }).click();
  await page.getByRole('button', { name: 'Generate Facts' }).click();
  const results = page.locator('.results-card');
  await expect(results).toBeVisible();
  await expect(results).toContainText('Fresh research · 3 searches · 4 pages opened');
  await expect(results).toContainText('The session captured a fresh web-researched fact.');
  await expect(results.getByRole('link', { name: 'Encyclopaedia Britannica' })).toHaveAttribute(
    'href', 'https://www.britannica.com/biography/Miles-Davis',
  );
  const testRequest = requestsFor(fixture, '/api/facts/test')[0]!;
  expect(testRequest.token).toBe(ADMIN_TOKEN);
  expect(testRequest.body).toEqual({ artist: 'The Beatles', album: 'Abbey Road', title: 'Come Together' });
  await page.screenshot({ path: testInfo.outputPath('codex-provider-research.png'), fullPage: true });

  await page.getByRole('button', { name: 'AI Facts' }).click();
  await page.locator('#provider').selectOption('anthropic');
  await expect(page.locator('#apiKey')).toHaveValue('retained-provider-api-key');
  await expect(page.locator('#maxOutputTokens')).toHaveValue('4096');
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect.poll(() => requestsFor(fixture, '/api/facts/config').length).toBe(2);
  const apiSave = requestsFor(fixture, '/api/facts/config')[1]!;
  expect(apiSave.token).toBe(ADMIN_TOKEN);
  expect(apiSave.body).toMatchObject({
    provider: 'anthropic', apiKey: 'retained-provider-api-key', maxOutputTokens: 4096,
  });

  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.getByLabel('Admin token')).toHaveValue('');
  await page.locator('#provider').selectOption('codex');
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(page.getByText('Unlock the ChatGPT account controls before changing subscription settings.')).toBeVisible();
  expect(requestsFor(fixture, '/api/facts/config')).toHaveLength(2);
  const storedValues = await page.evaluate(() => [
    ...Object.values({ ...localStorage }),
    ...Object.values({ ...sessionStorage }),
  ]);
  expect(storedValues.every((value) => !value.includes(ADMIN_TOKEN))).toBe(true);
});

test('locked Codex configuration and research fail before protected requests are sent', async ({ page }) => {
  const fixture = await installProviderFixture(page, { provider: 'codex' });
  await openFacts(page);

  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(page.getByText('Unlock the ChatGPT account controls before changing subscription settings.')).toBeVisible();
  expect(requestsFor(fixture, '/api/facts/config')).toHaveLength(0);

  await page.getByRole('button', { name: 'Test', exact: true }).click();
  await page.getByRole('button', { name: 'Generate Facts' }).click();
  await expect(page.getByText('Unlock the ChatGPT account controls in AI Facts before starting a research test.')).toBeVisible();
  expect(requestsFor(fixture, '/api/facts/test')).toHaveLength(0);
});

test('Codex is not offered when account-backed generation is unavailable', async ({ page }) => {
  await installProviderFixture(page, { generationEnabled: false });
  await openFacts(page);
  await expect(page.locator('#provider option[value="codex"]')).toHaveCount(0);
  await expect(page.locator('#apiKey')).toBeVisible();
});
