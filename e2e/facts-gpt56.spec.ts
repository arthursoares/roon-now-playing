import { test, expect } from '@playwright/test';

test('Luna defaults save and reload while preserving an existing custom token cap', async ({ page }, testInfo) => {
  let config = { provider: 'openai', model: 'gpt-6-astra', apiKey: '', factsCount: 5, rotationInterval: 25,
    prompt: 'My custom music facts prompt', maxOutputTokens: 4096, openaiReasoningEffort: 'low' };
  await page.routeWebSocket('**/ws**', () => {});
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/facts/config') {
      if (route.request().method() === 'POST') {
        config = { ...config, ...route.request().postDataJSON() };
        await route.fulfill({ json: { success: true } });
      } else await route.fulfill({ json: config });
    } else await route.fulfill({ json: {} });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'AI Facts', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced Settings', exact: true }).click();
  await expect(page.getByLabel('Maximum output tokens')).toHaveValue('4096');
  await expect(page.getByLabel('Reasoning effort')).toHaveValue('low');
  await page.getByLabel('Model', { exact: true }).selectOption('gpt-5.6-luna');
  await expect(page.getByLabel('Maximum output tokens')).toHaveValue('4096');
  await expect(page.getByLabel('Reasoning effort')).toHaveValue('none');
  await page.getByRole('button', { name: 'Use recommended (2048)', exact: true }).click();
  await expect(page.getByLabel('Maximum output tokens')).toHaveValue('2048');
  await page.getByRole('button', { name: 'Save Configuration', exact: true }).click();
  await expect.poll(() => config).toMatchObject({ model: 'gpt-5.6-luna', openaiReasoningEffort: 'none', maxOutputTokens: 2048,
    prompt: 'My custom music facts prompt' });
  await page.reload();
  await page.getByRole('button', { name: 'AI Facts', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced Settings', exact: true }).click();
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('gpt-5.6-luna');
  await expect(page.getByLabel('Reasoning effort')).toHaveValue('none');
  await expect(page.getByLabel('Maximum output tokens')).toHaveValue('2048');
  await page.getByLabel('Reasoning effort').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('luna-defaults.png') });
});
