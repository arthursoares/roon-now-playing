/**
 * Scenario: Manage protected external sources
 *   Given API-key protection is enabled
 *   When an administrator enters the current key and changes source settings
 *   Then mutations authenticate with that key and rejected requests stay visible
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, ref, type App } from 'vue';
import AdminView from './AdminView.vue';

vi.mock('../composables/useWebSocket', () => ({
  useWebSocket: () => ({ state: ref({ connected: true, roonEnabled: false, zones: [], clients: [] }) }),
}));

describe('Admin source authentication', () => {
  let app: App;
  let container: HTMLDivElement;
  let protectionEnabled: boolean;
  const fetchMock = vi.fn();

  async function settle() {
    await vi.waitFor(() => expect(container.textContent).not.toContain('Loading sources...'));
    await nextTick();
  }

  function button(label: string) {
    const match = [...container.querySelectorAll('button')].find((el) => el.textContent?.trim() === label);
    expect(match, `Button ${label}`).toBeDefined();
    return match!;
  }

  async function enterKey(key: string) {
    const input = container.querySelector<HTMLInputElement>('#sources-current-key');
    expect(input).not.toBeNull();
    input!.value = key;
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
  }

  beforeEach(async () => {
    protectionEnabled = true;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url === '/api/sources/config'
        ? { requireApiKey: protectionEnabled, hasApiKey: true, apiKey: 'masked...' }
        : url === '/api/sources'
          ? { zones: [{ zone_id: 'player', zone_name: 'Player', source_status: 'connected', last_seen: new Date().toISOString() }] }
          : url === '/api/admin/display-settings'
            ? { fontScale: 1, artworkScale: 100 }
            : { provider: 'anthropic', model: 'claude-haiku-4-5' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    container = document.createElement('div');
    document.body.append(container);
    app = createApp(AdminView);
    app.mount(container);
    button('Sources').click();
    await nextTick();
    await settle();
  });

  afterEach(() => {
    app.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it('uses the current key to disable protection', async () => {
    await enterKey('current-secret');
    container.querySelector<HTMLButtonElement>('.toggle-switch')!.click();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/sources/config', expect.objectContaining({
      headers: expect.objectContaining({ 'X-API-Key': 'current-secret' }),
      body: JSON.stringify({ requireApiKey: false }),
    })));
  });

  it('keeps protection enabled and displays rejected requests', async () => {
    await enterKey('wrong-secret');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Invalid or missing API key' }) });
    container.querySelector<HTMLButtonElement>('.toggle-switch')!.click();
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Invalid or missing API key'));
    expect(container.querySelector('.toggle-switch')?.classList.contains('active')).toBe(true);
  });

  it('uses a rotated key for subsequent source mutations', async () => {
    await enterKey('old-secret');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ apiKey: 'new-secret' }) });
    button('Regenerate').click();
    await vi.waitFor(() => expect(container.querySelector('.api-key-value')?.textContent).toBe('new-secret'));
    expect(fetchMock).toHaveBeenCalledWith('/api/sources/config/generate-key', expect.objectContaining({
      headers: expect.objectContaining({ 'X-API-Key': 'old-secret' }),
    }));
    container.querySelector<HTMLButtonElement>('[title="Delete zone"]')!.click();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/sources/player', expect.objectContaining({
      method: 'DELETE', headers: expect.objectContaining({ 'X-API-Key': 'new-secret' }),
    })));
  });

  it('does not offer to copy the masked key returned on reload', () => {
    expect(button('Copy').disabled).toBe(true);
  });

  it('requires possession of the saved key before re-enabling protection after a reload', async () => {
    protectionEnabled = false;
    app.unmount();
    app = createApp(AdminView);
    app.mount(container);
    button('Sources').click();
    await nextTick();
    await settle();
    const toggle = container.querySelector<HTMLButtonElement>('.toggle-switch')!;
    expect(toggle.disabled).toBe(true);
    await enterKey('saved-secret');
    expect(toggle.disabled).toBe(false);
    toggle.click();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/sources/config', expect.objectContaining({
      headers: expect.objectContaining({ 'X-API-Key': 'saved-secret' }),
      body: JSON.stringify({ requireApiKey: true }),
    })));
  });

  it('offers opt-in Smart Idle controls and saves their global settings', async () => {
    button('Display').click();
    await nextTick();
    const mode = container.querySelector<HTMLSelectElement>('#idleMode');
    expect(mode).not.toBeNull();
    expect(mode!.value).toBe('off');
    expect(container.textContent).toContain('does not control the device screen or power');

    mode!.value = 'layout';
    mode!.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect([...container.querySelectorAll<HTMLOptionElement>('#idleLayout option')].map((option) => option.value))
      .toContain('cover');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/display-settings', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"idleMode":"layout"'),
    })));
  });

  it('shows strict validation errors and preserves the rejected edit', async () => {
    button('Display').click();
    await nextTick();
    const mode = container.querySelector<HTMLSelectElement>('#idleMode')!;
    mode.value = 'clock';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/display-settings', expect.anything()));

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'idleDelayMinutes must be an integer between 1 and 60' }),
    });
    const delay = container.querySelector<HTMLInputElement>('#idleDelayMinutes')!;
    delay.value = '0';
    delay.dispatchEvent(new Event('input', { bubbles: true }));
    delay.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('idleDelayMinutes must be an integer between 1 and 60'));
    expect(delay.value).toBe('0');
  });

  it('shows only the loading state until display settings finish loading', async () => {
    app.unmount();
    let resolveDisplay!: (response: { ok: boolean; json: () => Promise<unknown> }) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/admin/display-settings') {
        return new Promise((resolve) => { resolveDisplay = resolve; });
      }
      return Promise.resolve({
        ok: true,
        json: async () => url === '/api/sources/config'
          ? { requireApiKey: true, hasApiKey: true, apiKey: 'masked...' }
          : url === '/api/sources'
            ? { zones: [] }
            : { provider: 'anthropic', model: 'claude-haiku-4-5' },
      });
    });
    app = createApp(AdminView);
    app.mount(container);
    button('Display').click();
    await nextTick();

    expect(container.textContent).toContain('Loading settings...');
    expect(container.querySelector('#idleMode')).toBeNull();
    resolveDisplay({ ok: true, json: async () => ({ fontScale: 1, artworkScale: 100 }) });
    await vi.waitFor(() => expect(container.querySelector('#idleMode')).not.toBeNull());
    expect(container.textContent).not.toContain('Loading settings...');
  });
});
