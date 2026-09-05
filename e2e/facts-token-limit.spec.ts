import { test, expect } from '@playwright/test';

test('saves and reloads the advanced output token limit', async ({ page }, testInfo) => {
  let saved = 1024;
  await page.routeWebSocket('**/ws**', () => {});
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/facts/config') {
      if (route.request().method() === 'POST') {
        saved = route.request().postDataJSON().maxOutputTokens;
        await route.fulfill({ json: { success: true } });
      } else {
        await route.fulfill({ json: {
          provider: 'local', model: 'test-model', apiKey: '', factsCount: 5,
          rotationInterval: 25, prompt: 'Facts about {title}', maxOutputTokens: saved,
        } });
      }
    } else {
      await route.fulfill({ json: url.pathname === '/api/sources' ? { zones: [] } : {} });
    }
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'AI Facts', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced Settings' }).click();
  const input = page.getByLabel('Maximum output tokens');
  await expect(input).toHaveValue('1024');
  await expect(input).toHaveAttribute('min', '1');
  await expect(input).toHaveAttribute('max', '65536');
  await input.fill('4096');
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect.poll(() => saved).toBe(4096);
  await page.reload();
  await page.getByRole('button', { name: 'AI Facts', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced Settings' }).click();
  await expect(page.getByLabel('Maximum output tokens')).toHaveValue('4096');
  await page.screenshot({ path: testInfo.outputPath('advanced-output-limit.png'), fullPage: true });
});
