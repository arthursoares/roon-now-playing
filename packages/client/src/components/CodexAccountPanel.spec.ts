import { createApp, nextTick, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodexAccountStatus } from '@roon-screen-cover/shared';
import CodexAccountPanel from './CodexAccountPanel.vue';

const signedOut: CodexAccountStatus = {
  state: 'signed-out', account: null, login: null, error: null, generationEnabled: false,
};
const pending: CodexAccountStatus = {
  state: 'signing-in', account: null,
  login: { loginId: 'login-1', verificationUrl: 'https://auth.openai.com/codex/device', userCode: 'ABCD-EFGH', expiresAt: '2030-01-02T12:30:00.000Z' },
  error: null, generationEnabled: false,
};
const signedIn: CodexAccountStatus = {
  state: 'signed-in', account: { email: 'listener@example.com', planType: 'Plus' }, login: null, error: null, generationEnabled: false,
};

function json(payload: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}

describe('CodexAccountPanel', () => {
  let app: App<Element> | null;
  let host: HTMLDivElement;
  const fetchMock = vi.fn<typeof fetch>();

  async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();
  }

  async function mountWith(fetchImplementation: typeof fetch): Promise<void> {
    fetchMock.mockImplementation(fetchImplementation);
    app = createApp(CodexAccountPanel);
    app.mount(host);
    await flush();
  }

  function button(label: string): HTMLButtonElement {
    const match = [...host.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === label);
    expect(match, `Button ${label}`).toBeDefined();
    return match!;
  }

  beforeEach(() => {
    app = null;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    app?.unmount();
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stays hidden when account connection is disabled', async () => {
    await mountWith(async () => json({ enabled: false, generationEnabled: false }));
    expect(host.textContent).toBe('');
    expect(fetchMock).toHaveBeenCalledWith('/api/codex/capabilities');
  });

  it('loads the account directly and starts device-code login without authorization headers', async () => {
    await mountWith(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/capabilities')) return json({ enabled: true, generationEnabled: false });
      if (url.endsWith('/account')) {
        expect(init?.headers).toBeUndefined();
        return json(signedOut);
      }
      if (url.endsWith('/login')) {
        expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return json(pending);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    await vi.waitFor(() => expect(host.textContent).toContain('No ChatGPT account is connected.'));
    expect(host.querySelector('#codex-admin-token')).toBeNull();
    expect(host.textContent).not.toContain('Unlock account controls');
    button('Connect ChatGPT').click();
    await vi.waitFor(() => expect(host.textContent).toContain('ABCD-EFGH'));
    const link = host.querySelector<HTMLAnchorElement>('a.verification-link');
    expect(link?.href).toBe('https://auth.openai.com/codex/device');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener noreferrer');
  });

  it('does not render a link for an unrecognized verification URL', async () => {
    const unsafePending = { ...pending, login: { ...pending.login!, verificationUrl: 'https://example.com/codex/device' } };
    await mountWith(async input => String(input).endsWith('/capabilities')
      ? json({ enabled: true, generationEnabled: false })
      : json(unsafePending));
    await vi.waitFor(() => expect(host.textContent).toContain('unrecognized verification address'));
    expect(host.querySelector('a.verification-link')).toBeNull();
  });

  it('cancels a pending login and logs out with ordinary JSON requests', async () => {
    let account = pending;
    await mountWith(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/capabilities')) return json({ enabled: true, generationEnabled: false });
      if (url.endsWith('/account')) return json(account);
      if (url.endsWith('/login/cancel')) {
        expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId: 'login-1' }) });
        account = signedOut;
        return json(account);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    await vi.waitFor(() => expect(host.textContent).toContain('Waiting for approval'));
    button('Cancel connection').click();
    await vi.waitFor(() => expect(host.textContent).toContain('No ChatGPT account is connected.'));
  });

  it('logs out with an ordinary JSON request', async () => {
    await mountWith(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/capabilities')) return json({ enabled: true, generationEnabled: false });
      if (url.endsWith('/account')) return json(signedIn);
      if (url.endsWith('/logout')) {
        expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return json(signedOut);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    await vi.waitFor(() => expect(host.textContent).toContain('listener@example.com'));
    button('Sign out').click();
    await vi.waitFor(() => expect(host.textContent).toContain('No ChatGPT account is connected.'));
  });

  it('shows service errors without changing account-control availability', async () => {
    await mountWith(async input => String(input).endsWith('/capabilities')
      ? json({ enabled: true, generationEnabled: false })
      : json({ error: 'service_unavailable', message: 'Account service is starting.' }, 503));
    await vi.waitFor(() => expect(host.textContent).toContain('Account service is starting.'));
    expect(host.querySelector('#codex-admin-token')).toBeNull();
  });

  it('ignores an aborted late poll after pagehide and resumes status polling on pageshow', async () => {
    vi.useFakeTimers();
    let requests = 0;
    let lateSignal: AbortSignal | undefined;
    let resolveLate!: (response: Response) => void;
    await mountWith((input, init) => {
      if (String(input).endsWith('/capabilities')) return Promise.resolve(json({ enabled: true, generationEnabled: false }));
      requests += 1;
      if (requests === 1) return Promise.resolve(json(pending));
      if (requests === 2) {
        lateSignal = init?.signal ?? undefined;
        return new Promise(resolve => { resolveLate = resolve; });
      }
      return Promise.resolve(json(signedIn));
    });
    await flush();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(lateSignal?.aborted).toBe(false);
    window.dispatchEvent(new Event('pagehide'));
    expect(lateSignal?.aborted).toBe(true);
    resolveLate(json(signedIn));
    await flush();
    expect(host.textContent).not.toContain('listener@example.com');
    window.dispatchEvent(new Event('pageshow'));
    await vi.waitFor(() => expect(host.textContent).toContain('listener@example.com'));
  });

  it('aborts an in-flight status request when unmounted', async () => {
    let signal: AbortSignal | undefined;
    await mountWith((input, init) => {
      if (String(input).endsWith('/capabilities')) return Promise.resolve(json({ enabled: true, generationEnabled: false }));
      signal = init?.signal ?? undefined;
      return new Promise(() => {});
    });
    expect(signal?.aborted).toBe(false);
    app!.unmount();
    app = null;
    expect(signal?.aborted).toBe(true);
  });
});
