import { expect, test, type Page } from '@playwright/test';
import type { CodexAccountStatus, FactsConfig } from '../packages/shared/src/index.ts';

const signedIn: CodexAccountStatus = {
  state: 'signed-in', account: { email: 'researcher@example.com', planType: 'Plus' }, login: null, error: null, generationEnabled: true,
};

interface RecordedRequest {
  method: string;
  path: string;
  authorization: string | undefined;
  body: unknown;
}

async function installProviderFixture(page: Page, generationEnabled = true): Promise<{ requests: RecordedRequest[]; llmRequests: string[] }> {
  let config: FactsConfig = {
    provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'retained-provider-api-key', factsCount: 5,
    rotationInterval: 25, prompt: 'Facts about {title}', maxOutputTokens: 4096,
  };
  const requests: RecordedRequest[] = [];
  const llmRequests: string[] = [];
  page.on('request', request => {
    if (/(api\.openai\.com|api\.anthropic\.com|openrouter\.ai|localhost:11434)/.test(request.url())) {
      llmRequests.push(request.url());
    }
  });
  await page.routeWebSocket('**/ws**', connection => {
    connection.onMessage(() => {
      connection.send(JSON.stringify({ type: 'connection', status: 'connected', roon_connected: false, roon_enabled: false }));
      connection.send(JSON.stringify({ type: 'clients_list', clients: [] }));
      connection.send(JSON.stringify({ type: 'zones', zones: [] }));
    });
  });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() ? request.postDataJSON() : null;
    requests.push({ method: request.method(), path, authorization: request.headers().authorization, body });
    if (path === '/api/codex/capabilities') return route.fulfill({ json: { enabled: true, generationEnabled } });
    if (path === '/api/codex/account') return route.fulfill({ json: signedIn });
    if (path === '/api/facts/config' && request.method() === 'GET') return route.fulfill({ json: config });
    if (path === '/api/facts/config' && request.method() === 'POST') {
      config = { ...config, ...(body as Partial<FactsConfig>) };
      return route.fulfill({ json: config });
    }
    if (path === '/api/facts') return route.fulfill({ json: {
      facts: ['The warm result was returned from the track research cache.'],
      cached: true,
      generatedAt: Date.now(),
      sources: [[{ url: 'https://musicbrainz.org/artist/example', title: 'MusicBrainz' }]],
      research: { cache: 'track', webSearches: 0, openPages: 0 },
    } });
    if (path === '/api/facts/test') return route.fulfill({ json: {
      facts: ['The session captured a fresh web-researched fact.', 'Its second result carries a separate source.'],
      sources: [[{ url: 'https://www.britannica.com/biography/Miles-Davis', title: 'Encyclopaedia Britannica' }], [{ url: 'https://musicbrainz.org/artist/example', title: 'MusicBrainz' }]],
      durationMs: 1500, research: { cache: 'miss', webSearches: 3, openPages: 4, durationMs: 1450 },
    } });
    if (path === '/api/sources/config') return route.fulfill({ json: { requireApiKey: false, hasApiKey: false, apiKey: '' } });
    if (path === '/api/sources') return route.fulfill({ json: { zones: [] } });
    if (path === '/api/admin/display-settings') return route.fulfill({ json: { fontScale: 1, artworkScale: 100 } });
    return route.fulfill({ status: 404, json: { error: `Unexpected fixture request: ${path}` } });
  });
  return { requests, llmRequests };
}

async function openFacts(page: Page): Promise<void> {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'AI Facts' }).click();
  await expect(page.getByRole('heading', { name: 'AI Facts Configuration' })).toBeVisible();
  await expect(page.locator('#provider')).toBeVisible();
}

function requestsFor(fixture: { requests: RecordedRequest[] }, path: string): RecordedRequest[] {
  return fixture.requests.filter(request => request.path === path && request.method === 'POST');
}

test('active account capability reuses cached Codex facts and only researches again on request', async ({ page }, testInfo) => {
  const fixture = await installProviderFixture(page);
  await openFacts(page);
  await expect(page.getByText('researcher@example.com')).toBeVisible();
  await expect(page.locator('#provider option[value="codex"]')).toHaveText('ChatGPT (Codex)');
  await page.locator('#provider').selectOption('codex');
  await expect(page.locator('#apiKey')).toHaveCount(0);
  await page.getByRole('button', { name: 'Advanced Settings' }).click();
  await expect(page.locator('#maxOutputTokens')).toHaveCount(0);

  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect.poll(() => requestsFor(fixture, '/api/facts/config').length).toBe(1);
  const save = requestsFor(fixture, '/api/facts/config')[0]!;
  expect(save.authorization).toBeUndefined();
  expect(save.body).toMatchObject({ provider: 'codex', apiKey: 'retained-provider-api-key', maxOutputTokens: 4096 });

  await page.getByRole('button', { name: 'Test', exact: true }).click();
  await page.getByRole('button', { name: 'Get Facts' }).click();
  const results = page.locator('.results-card');
  await expect(results).toBeVisible();
  await expect(results).toContainText('track cache · 0 searches · 0 pages opened');
  await expect(results).toContainText('The warm result was returned from the track research cache.');
  const cachedRequest = requestsFor(fixture, '/api/facts')[0]!;
  expect(cachedRequest.authorization).toBeUndefined();
  expect(cachedRequest.body).toEqual({ artist: 'The Beatles', album: 'Abbey Road', title: 'Come Together' });

  await page.getByRole('button', { name: 'Research Again' }).click();
  await expect(results).toContainText('Fresh research · 3 searches · 4 pages opened');
  await expect(results).toContainText('The session captured a fresh web-researched fact.');
  await expect(results.getByRole('link', { name: 'Encyclopaedia Britannica' })).toHaveAttribute('href', 'https://www.britannica.com/biography/Miles-Davis');
  const testRequest = requestsFor(fixture, '/api/facts/test')[0]!;
  expect(testRequest.authorization).toBeUndefined();
  expect(testRequest.body).toEqual({ artist: 'The Beatles', album: 'Abbey Road', title: 'Come Together' });
  expect(fixture.llmRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('codex-provider-research.png'), fullPage: true });
});

test('Codex is not offered when account-backed generation is unavailable', async ({ page }) => {
  await installProviderFixture(page, false);
  await openFacts(page);
  await expect(page.locator('#provider option[value="codex"]')).toHaveCount(0);
  await expect(page.locator('#apiKey')).toBeVisible();
});
