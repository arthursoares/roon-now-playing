import { expect, test, type Page } from '@playwright/test';
import type { CodexAccountStatus } from '../packages/shared/src/index.ts';

const DEVICE_URL = 'https://auth.openai.com/codex/device';
const signedOut: CodexAccountStatus = { state: 'signed-out', account: null, login: null, error: null, generationEnabled: false };
const signedIn: CodexAccountStatus = {
  state: 'signed-in', account: { email: 'listener@example.com', planType: 'Plus' }, login: null, error: null, generationEnabled: false,
};

interface CodexFixture {
  connectAccount(): void;
  useUnsafeVerificationUrl(): void;
  requests: Array<{ path: string; authorization: string | undefined; body: unknown }>;
}

async function installAdminFixture(page: Page): Promise<CodexFixture> {
  let account = signedOut;
  let loginNumber = 0;
  let unsafeVerificationUrl = false;
  const requests: CodexFixture['requests'] = [];

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
    requests.push({ path, authorization: request.headers().authorization, body });

    if (path === '/api/codex/capabilities') return route.fulfill({ json: { enabled: true, generationEnabled: false } });
    if (path === '/api/codex/account') return route.fulfill({ json: account });
    if (path === '/api/codex/login') {
      loginNumber += 1;
      account = {
        state: 'signing-in', account: null,
        login: {
          loginId: `login-${loginNumber}`,
          verificationUrl: unsafeVerificationUrl ? 'https://example.com/collect' : DEVICE_URL,
          userCode: 'ABCD-EFGH', expiresAt: '2030-01-02T12:30:00.000Z',
        },
        error: null, generationEnabled: false,
      };
      return route.fulfill({ json: account });
    }
    if (path === '/api/codex/login/cancel') {
      expect(body).toEqual({ loginId: account.login?.loginId });
      account = signedOut;
      return route.fulfill({ json: account });
    }
    if (path === '/api/codex/logout') {
      account = signedOut;
      return route.fulfill({ json: account });
    }
    if (path === '/api/facts/config') return route.fulfill({ json: { provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: '', factsCount: 5, rotationInterval: 25, prompt: 'Facts about {title}', maxOutputTokens: 1024 } });
    if (path === '/api/sources/config') return route.fulfill({ json: { requireApiKey: false, hasApiKey: false, apiKey: '' } });
    if (path === '/api/sources') return route.fulfill({ json: { zones: [] } });
    if (path === '/api/admin/display-settings') return route.fulfill({ json: { fontScale: 1, artworkScale: 100 } });
    throw new Error(`Unexpected admin API request: ${request.method()} ${path}`);
  });

  return { connectAccount: () => { account = signedIn; }, useUnsafeVerificationUrl: () => { unsafeVerificationUrl = true; }, requests };
}

async function openAccountPanel(page: Page): Promise<void> {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'AI Facts' }).click();
  await expect(page.getByRole('heading', { name: 'ChatGPT account' })).toBeVisible();
  await expect(page.getByText('No ChatGPT account is connected.')).toBeVisible();
}

test('direct device-code account controls connect, cancel, and log out without authorization headers', async ({ page }, testInfo) => {
  const fixture = await installAdminFixture(page);
  await openAccountPanel(page);
  await expect(page.getByLabel('Admin token')).toHaveCount(0);
  await page.getByRole('button', { name: 'Connect ChatGPT' }).click();
  await expect(page.getByText('ABCD-EFGH')).toBeVisible();
  const verificationLink = page.getByRole('link', { name: 'Open ChatGPT verification' });
  await expect(verificationLink).toHaveAttribute('href', DEVICE_URL);
  await expect(verificationLink).toHaveAttribute('target', '_blank');
  await expect(verificationLink).toHaveAttribute('rel', 'noopener noreferrer');
  await page.screenshot({ path: testInfo.outputPath('codex-account-pending.png'), fullPage: true });

  fixture.connectAccount();
  await expect(page.getByText('listener@example.com')).toBeVisible({ timeout: 4_500 });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByText('No ChatGPT account is connected.')).toBeVisible();
  await page.getByRole('button', { name: 'Connect ChatGPT' }).click();
  await expect(page.getByText('Waiting for approval')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel connection' }).click();
  await expect(page.getByText('No ChatGPT account is connected.')).toBeVisible();

  const codexRequests = fixture.requests.filter(({ path }) => path.startsWith('/api/codex/'));
  expect(codexRequests.length).toBeGreaterThan(0);
  expect(codexRequests.every(({ authorization }) => authorization === undefined)).toBe(true);
});

test('an invalid verification URL is never rendered or followed', async ({ page }) => {
  const fixture = await installAdminFixture(page);
  fixture.useUnsafeVerificationUrl();
  await openAccountPanel(page);
  await page.getByRole('button', { name: 'Connect ChatGPT' }).click();
  await expect(page.getByText('The server returned an unrecognized verification address.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open ChatGPT verification' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin$/);
});
