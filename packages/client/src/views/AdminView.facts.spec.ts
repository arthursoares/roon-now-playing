import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, ref, type App } from 'vue';
import AdminView from './AdminView.vue';

vi.mock('../composables/useWebSocket', () => ({
  useWebSocket: () => ({ state: ref({ connected: true, roonEnabled: false, zones: [], clients: [] }) }),
}));

describe('facts model defaults', () => {
  let app: App;
  let host: HTMLDivElement;
  let config: Record<string, unknown>;
  const fetchMock = vi.fn();
  beforeEach(() => {
    config = { provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: '', factsCount: 5,
      rotationInterval: 25, prompt: 'Custom prompt', maxOutputTokens: 1024 };
    fetchMock.mockReset().mockImplementation(async (url: string) => ({ ok: true, json: async () =>
      url === '/api/facts/config' ? config : url === '/api/sources' ? { zones: [] } : {} }));
    vi.stubGlobal('fetch', fetchMock);
    host = document.createElement('div');
    document.body.append(host);
  });
  afterEach(() => { app?.unmount(); host.remove(); vi.unstubAllGlobals(); });
  function button(label: string) {
    const element = [...host.querySelectorAll('button')].find((el) => el.textContent?.trim() === label);
    expect(element, label).toBeDefined();
    return element!;
  }
  async function mount() {
    app = createApp(AdminView);
    app.mount(host);
    button('AI Facts').click();
    await vi.waitFor(() => expect(host.querySelector('#provider')).not.toBeNull());
    button('Advanced Settings').click();
    await nextTick();
  }
  async function select(id: string, value: string) {
    const element = host.querySelector<HTMLSelectElement>(`#${id}`)!;
    expect(element).not.toBeNull();
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
  }
  function value(id: string) { return host.querySelector<HTMLInputElement>(`#${id}`)?.value; }

  it('recommends Luna, no reasoning, and a small output budget for new OpenAI selections', async () => {
    await mount();
    await select('provider', 'openai');
    expect(value('model')).toBe('gpt-5.6-luna');
    expect(value('openaiReasoningEffort')).toBe('none');
    expect(value('maxOutputTokens')).toBe('2048');
  });

  it('preserves a saved Astra model/cap and recommends compatible reasoning', async () => {
    config = { ...config, provider: 'openai', model: 'gpt-6-astra', maxOutputTokens: 4096 };
    await mount();
    expect(value('model')).toBe('gpt-6-astra');
    expect(value('maxOutputTokens')).toBe('4096');
    expect(value('openaiReasoningEffort')).toBe('low');
    button('Use recommended (8192)').click();
    await nextTick();
    expect(value('maxOutputTokens')).toBe('8192');
  });

  it('updates untouched model defaults but preserves a custom token ceiling', async () => {
    config = { ...config, provider: 'openai', model: 'gpt-5.6-luna', maxOutputTokens: 2048 };
    await mount();
    await select('model', 'gpt-6-astra');
    expect(value('openaiReasoningEffort')).toBe('low');
    expect(value('maxOutputTokens')).toBe('8192');
    const input = host.querySelector<HTMLInputElement>('#maxOutputTokens')!;
    input.value = '12345';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await select('model', 'gpt-5.6-luna');
    expect(value('openaiReasoningEffort')).toBe('none');
    expect(value('maxOutputTokens')).toBe('12345');
  });

  it('saves explicit reasoning selection without changing the custom prompt', async () => {
    config = { ...config, provider: 'openai', model: 'gpt-5.6-luna', maxOutputTokens: 2048 };
    await mount();
    await select('openaiReasoningEffort', 'low');
    button('Save Configuration').click();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/facts/config', expect.objectContaining({ method: 'POST' })));
    const request = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(request[1].body)).toMatchObject({ model: 'gpt-5.6-luna', openaiReasoningEffort: 'low', prompt: 'Custom prompt' });
  });
  it('reset clears expensive reasoning before save, reload, and provider switching', async () => {
    config = { ...config, provider: 'openai', model: 'gpt-5.6-sol', openaiReasoningEffort: 'high', maxOutputTokens: 4096 };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/facts/config' && init?.method === 'POST') config = { ...config, ...JSON.parse(init.body as string) };
      return { ok: true, json: async () => url === '/api/facts/config' ? config : url === '/api/sources' ? { zones: [] } : {} };
    });
    await mount();
    button('Reset to Defaults').click();
    await nextTick();
    button('Save Configuration').click();
    await vi.waitFor(() => expect(config.openaiReasoningEffort).toBe('none'));
    app.unmount();
    await mount();
    await select('provider', 'openai');
    expect(value('model')).toBe('gpt-5.6-luna');
    expect(value('openaiReasoningEffort')).toBe('none');
  });

});

describe('facts test retrieval', () => {
  let app: App;
  let host: HTMLDivElement;
  const fetchMock = vi.fn();

  function button(label: string) {
    const element = [...host.querySelectorAll('button')].find((el) => el.textContent?.trim() === label);
    expect(element, label).toBeDefined();
    return element!;
  }

  async function mount(provider = 'codex') {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url === '/api/facts/config'
        ? { provider, model: provider === 'codex' ? 'gpt-5.6-luna' : 'claude-haiku-4-5', apiKey: '', factsCount: 5, rotationInterval: 25, prompt: 'Facts' }
        : url === '/api/codex/capabilities' ? { enabled: true, generationEnabled: true }
          : url === '/api/sources' ? { zones: [] } : {},
    }));
    vi.stubGlobal('fetch', fetchMock);
    host = document.createElement('div');
    document.body.append(host);
    app = createApp(AdminView);
    app.mount(host);
    button('Test').click();
    await vi.waitFor(() => expect(host.querySelector('#testArtist')).not.toBeNull());
  }

  beforeEach(() => { fetchMock.mockReset(); });
  afterEach(() => { app?.unmount(); host?.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it.each([
    ['codex', 'anthropic', 'Research Again'],
    ['anthropic', 'codex', 'Generate Fresh Facts'],
  ])('uses saved %s settings despite an unsaved %s selection', async (saved, draft, expectedLabel) => {
    await mount(saved);
    button('AI Facts').click();
    await vi.waitFor(() => expect(host.querySelector(`#provider option[value="${draft}"]`)).not.toBeNull());
    const provider = host.querySelector<HTMLSelectElement>('#provider')!;
    provider.value = draft;
    provider.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    button('Test').click();
    await nextTick();
    expect(button(expectedLabel)).toBeDefined();
  });

  it('includes reading the response body in the displayed retrieval duration', async () => {
    await mount();
    let time = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => {
        time = 1375;
        return { facts: ['Received fact'], cached: true };
      },
    }));
    button('Get Facts').click();
    await vi.waitFor(() => expect(host.querySelector('.results-card')?.textContent).toContain('375 ms'));
  });

  it('uses the cache-aware facts endpoint for Get Facts and shows a zero-millisecond cached response', async () => {
    await mount();
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url === '/api/facts'
        ? { facts: ['Warm cached fact'], cached: true, generatedAt: Date.now(), sources: [[{ url: 'https://musicbrainz.org/artist/example', title: 'Source' }]], research: { cache: 'track', webSearches: 0, openPages: 0 } }
        : {},
    }));

    button('Get Facts').click();

    await vi.waitFor(() => expect(host.querySelector('.results-card')?.textContent).toContain('Warm cached fact'));
    expect(fetchMock).toHaveBeenCalledWith('/api/facts', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ artist: 'The Beatles', album: 'Abbey Road', title: 'Come Together' }),
    }));
    expect(fetchMock).not.toHaveBeenCalledWith('/api/facts/test', expect.anything());
    expect(host.querySelector('.results-card')?.textContent).toContain('track cache · 0 searches · 0 pages opened');
    expect(host.querySelector('.results-card')?.textContent).toContain('0 ms');
    expect(host.querySelector('.fact-sources')?.textContent).toContain('Source');
    now.mockRestore();
  });

  it('uses the fresh test endpoint for Research Again and keeps error feedback', async () => {
    await mount();
    fetchMock.mockImplementation(async (url: string) => ({
      ok: url !== '/api/facts/test',
      json: async () => url === '/api/facts/test'
        ? { error: { message: 'Fresh research failed' } } : {},
    }));

    button('Research Again').click();

    await vi.waitFor(() => expect(host.textContent).toContain('Fresh research failed'));
    expect(fetchMock).toHaveBeenCalledWith('/api/facts/test', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ artist: 'The Beatles', album: 'Abbey Road', title: 'Come Together' }),
    }));
  });

  it('labels cache-aware non-Codex responses with their cached status', async () => {
    await mount('anthropic');
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url === '/api/facts' ? { facts: ['Cached provider fact'], cached: true, generatedAt: Date.now() } : {},
    }));

    button('Get Facts').click();

    await vi.waitFor(() => expect(host.querySelector('.results-card')?.textContent).toContain('Cached facts'));
    expect(button('Generate Fresh Facts')).toBeDefined();
  });
});
