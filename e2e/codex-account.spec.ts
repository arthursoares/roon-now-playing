import { expect, test, type Page } from '@playwright/test';
import type { CodexAccountStatus } from '../packages/shared/src/index.ts';

const ADMIN_TOKEN = 'fixture-dedicated-admin-token-1234567890';
const REJECTED_TOKEN = 'fixture-rejected-admin-token-123456789';
const DEVICE_URL = 'https://auth.openai.com/codex/device';

const signedOut: CodexAccountStatus = {
  state: 'signed-out', account: null, login: null, error: null, generationEnabled: false,
};

function pending(loginId: string, verificationUrl = DEVICE_URL): CodexAccountStatus {
  return {
    state: 'signing-in',
    account: null,
    login: {
      loginId,
      verificationUrl,
      userCode: 'ABCD-EFGH',
      expiresAt: '2030-01-02T12:30:00.000Z',
    },
    error: null,
    generationEnabled: false,
  };
}

const signedIn: CodexAccountStatus = {
  state: 'signed-in',
  account: { email: 'listener@example.com', planType: 'Plus' },
  login: null,
  error: null,
  generationEnabled: false,
};

interface CodexFixture {
  connectAccount(): void;
  useUnsafeVerificationUrl(): void;
  requests: Array<{ path: string; token: string | null; body: unknown }>;
}

async function installAdminFixture(page: Page): Promise<CodexFixture> {
  let account = signedOut;
  let loginNumber = 0;
  let unsafeVerificationUrl = false;
  const requests: CodexFixture['requests'] = [];

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
    const token = request.headers().authorization?.replace(/^Bearer /, '') ?? null;
    const body = request.postData() ? request.postDataJSON() : null;
    requests.push({ path, token, body });

    if (path === '/api/codex/capabilities') {
      await route.fulfill({ json: { enabled: true, generationEnabled: false } });
      return;
    }
    if (path.startsWith('/api/codex/') && token === REJECTED_TOKEN) {
      await route.fulfill({
        status: 401,
        json: { error: 'unauthorized', message: 'Invalid or missing admin token' },
      });
      return;
    }
    if (path === '/api/codex/account') {
      await route.fulfill({ json: account });
      return;
    }
    if (path === '/api/codex/login') {
      loginNumber += 1;
      account = pending(
        `login-${loginNumber}`,
        unsafeVerificationUrl ? 'https://example.com/collect' : DEVICE_URL,
      );
      await route.fulfill({ json: account });
      return;
    }
    if (path === '/api/codex/login/cancel') {
      expect(body).toEqual({ loginId: account.login?.loginId });
      account = signedOut;
      await route.fulfill({ json: account });
      return;
    }
    if (path === '/api/codex/logout') {
      account = signedOut;
      await route.fulfill({ json: account });
      return;
    }
    if (path === '/api/facts/config') {
      await route.fulfill({
        json: {
          provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: '', factsCount: 5,
          rotationInterval: 25, prompt: 'Facts about {title}', maxOutputTokens: 1024,
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

    throw new Error(`Unexpected admin API request: ${request.method()} ${path}`);
  });

  return {
    connectAccount() { account = signedIn; },
    useUnsafeVerificationUrl() { unsafeVerificationUrl = true; },
    requests,
  };
}

async function openAccountPanel(page: Page): Promise<void> {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'AI Facts' }).click();
  await expect(page.getByRole('heading', { name: 'ChatGPT account' })).toBeVisible();
  await expect(page.getByText('Using a ChatGPT subscription to generate facts is not available yet.')).toBeVisible();
  await expect(page.locator('#apiKey')).toBeVisible();
}

async function unlock(page: Page, token = ADMIN_TOKEN): Promise<void> {
  await page.getByLabel('Admin token').fill(token);
  await page.getByRole('button', { name: 'Unlock account controls' }).click();
}

test('device-code account controls complete, cancel, logout, reject, and lock safely', async ({ page }, testInfo) => {
  const fixture = await installAdminFixture(page);
  await openAccountPanel(page);
  await unlock(page);

  await expect(page.getByText('No ChatGPT account is connected.')).toBeVisible();
  await page.getByRole('button', { name: 'Connect ChatGPT' }).click();
  await expect(page.getByText('ABCD-EFGH')).toBeVisible();
  const verificationLink = page.getByRole('link', { name: 'Open ChatGPT verification' });
  await expect(verificationLink).toHaveAttribute('href', DEVICE_URL);
  await expect(verificationLink).toHaveAttribute('target', '_blank');
  await expect(verificationLink).toHaveAttribute('rel', 'noopener noreferrer');
  await page.screenshot({ path: testInfo.outputPath('codex-account-pending.png'), fullPage: true });

  fixture.connectAccount();
  await expect(page.getByText('listener@example.com')).toBeVisible({ timeout: 4_500 });
  await expect(page.getByText('Plus', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByText('No ChatGPT account is connected.')).toBeVisible();

  await page.getByRole('button', { name: 'Connect ChatGPT' }).click();
  await expect(page.getByText('Waiting for approval')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel connection' }).click();
  await expect(page.getByText('No ChatGPT account is connected.')).toBeVisible();

  await page.getByRole('button', { name: 'Lock account controls' }).click();
  await expect(page.getByLabel('Admin token')).toHaveValue('');
  const persistedValues = await page.evaluate(() => [
    ...Object.values({ ...localStorage }),
    ...Object.values({ ...sessionStorage }),
  ]);
  expect(persistedValues.every((value) => !value.includes(ADMIN_TOKEN) && !value.includes(REJECTED_TOKEN))).toBe(true);

  await unlock(page, REJECTED_TOKEN);
  await expect(page.getByText(/admin token was rejected/i)).toBeVisible();
  await expect(page.getByLabel('Admin token')).toHaveValue('');

  const protectedRequests = fixture.requests.filter(({ path }) => path.startsWith('/api/codex/')
    && path !== '/api/codex/capabilities');
  expect(protectedRequests.length).toBeGreaterThan(0);
  expect(protectedRequests.every(({ token }) => token === ADMIN_TOKEN || token === REJECTED_TOKEN)).toBe(true);
  expect(fixture.requests.find(({ path }) => path === '/api/codex/capabilities')?.token).toBeNull();
});

test('an invalid verification URL is never rendered or followed', async ({ page }) => {
  const fixture = await installAdminFixture(page);
  fixture.useUnsafeVerificationUrl();
  await openAccountPanel(page);
  await unlock(page);
  await page.getByRole('button', { name: 'Connect ChatGPT' }).click();

  await expect(page.getByText('The server returned an unrecognized verification address.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open ChatGPT verification' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin$/);
});
