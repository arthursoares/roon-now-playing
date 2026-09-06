import { createApp, nextTick, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodexAccountStatus } from '@roon-screen-cover/shared';
import CodexAccountPanel from './CodexAccountPanel.vue';

const signedOut: CodexAccountStatus = {
  state: 'signed-out', account: null, login: null, error: null, generationEnabled: false,
};
const pending: CodexAccountStatus = {
  state: 'signing-in',
  account: null,
  login: {
    loginId: 'login-1',
    verificationUrl: 'https://auth.openai.com/codex/device',
    userCode: 'ABCD-EFGH',
    expiresAt: '2030-01-02T12:30:00.000Z',
  },
  error: null,
  generationEnabled: false,
};
const signedIn: CodexAccountStatus = {
  state: 'signed-in',
  account: { email: 'listener@example.com', planType: 'Plus' },
  login: null,
  error: null,
  generationEnabled: false,
};

function json(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('CodexAccountPanel', () => {
  let app: App<Element> | null;
  let host: HTMLDivElement;
  const fetchMock = vi.fn<typeof fetch>();
  const clipboardWrite = vi.fn();

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
    const match = [...host.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === label);
    expect(match, `Button ${label}`).toBeDefined();
    return match!;
  }

  async function unlock(token = 'dedicated-admin-token'): Promise<void> {
    const input = host.querySelector<HTMLInputElement>('#codex-admin-token');
    expect(input).not.toBeNull();
    input!.value = token;
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
  }

  beforeEach(() => {
    app = null;
    fetchMock.mockReset();
    clipboardWrite.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: clipboardWrite } });
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/codex/capabilities');
  });

  it('shows a memory-only password unlock while keeping subscription facts explicitly unavailable', async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    await mountWith(async () => json({ enabled: true, generationEnabled: false }));

    const input = host.querySelector<HTMLInputElement>('#codex-admin-token');
    expect(input?.type).toBe('password');
    expect(input?.autocomplete).toBe('off');
    expect(host.textContent).toContain('Using a ChatGPT subscription to generate facts is not available yet.');

    input!.value = 'only-in-memory';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  });

  it('starts device-code login and only links the exact trusted verification URL', async () => {
    await mountWith(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/capabilities')) return json({ enabled: true, generationEnabled: false });
      if (url.endsWith('/account')) return json(signedOut);
      if (url.endsWith('/login')) {
        expect(init).toMatchObject({
          method: 'POST',
          headers: { Authorization: 'Bearer dedicated-admin-token', 'Content-Type': 'application/json' },
          body: '{}',
        });
        return json(pending);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    await unlock();
    await vi.waitFor(() => expect(host.textContent).toContain('No ChatGPT account is connected.'));

    button('Connect ChatGPT').click();
    await vi.waitFor(() => expect(host.textContent).toContain('ABCD-EFGH'));

    const link = host.querySelector<HTMLAnchorElement>('a.verification-link');
    expect(link?.href).toBe('https://auth.openai.com/codex/device');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener noreferrer');
    expect(link?.href).not.toContain('dedicated-admin-token');

    button('Copy code').click();
    await vi.waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('ABCD-EFGH'));
  });

  it('does not render a link for an unrecognized verification URL', async () => {
    const unsafePending = {
      ...pending,
      login: { ...pending.login!, verificationUrl: 'https://example.com/codex/device' },
    };
    await mountWith(async (input) => String(input).endsWith('/capabilities')
      ? json({ enabled: true, generationEnabled: false })
      : json(unsafePending));
    await unlock();
    await vi.waitFor(() => expect(host.textContent).toContain('unrecognized verification address'));

    expect(host.querySelector('a.verification-link')).toBeNull();
  });

  it('cancels a pending login with its login id', async () => {
    await mountWith(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/capabilities')) return json({ enabled: true, generationEnabled: false });
      if (url.endsWith('/account')) return json(pending);
      if (url.endsWith('/login/cancel')) {
        expect(init).toMatchObject({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer dedicated-admin-token' }),
          body: JSON.stringify({ loginId: 'login-1' }),
        });
        return json(signedOut);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    await unlock();
    await vi.waitFor(() => expect(host.textContent).toContain('Waiting for approval'));

    button('Cancel connection').click();
    await vi.waitFor(() => expect(host.textContent).toContain('No ChatGPT account is connected.'));
  });

  it('shows connected account details and signs out without locking the controls', async () => {
    await mountWith(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/capabilities')) return json({ enabled: true, generationEnabled: false });
      if (url.endsWith('/account')) return json(signedIn);
      if (url.endsWith('/logout')) {
        expect(init).toMatchObject({ method: 'POST', body: '{}' });
        return json(signedOut);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    await unlock();
    await vi.waitFor(() => expect(host.textContent).toContain('listener@example.com'));
    expect(host.textContent).toContain('Plus');

    button('Sign out').click();
    await vi.waitFor(() => expect(host.textContent).toContain('No ChatGPT account is connected.'));
    expect(host.textContent).toContain('Account controls unlocked');
  });

  it('locks and clears account data after a 401 response', async () => {
    await mountWith(async (input) => String(input).endsWith('/capabilities')
      ? json({ enabled: true, generationEnabled: false })
      : json({ error: 'unauthorized', message: 'Invalid token' }, 401));
    await unlock('rejected-token');
    await vi.waitFor(() => expect(host.textContent).toContain('admin token was rejected'));

    expect(host.querySelector('#codex-admin-token')).not.toBeNull();
    expect(host.textContent).not.toContain('Account controls unlocked');
    expect(host.textContent).not.toContain('Invalid token');
  });

  it('shows structured service errors and keeps the controls unlocked', async () => {
    await mountWith(async (input) => String(input).endsWith('/capabilities')
      ? json({ enabled: true, generationEnabled: false })
      : json({ error: 'service_unavailable', message: 'Account service is starting.' }, 503));
    await unlock();
    await vi.waitFor(() => expect(host.textContent).toContain('Account service is starting.'));

    expect(host.textContent).toContain('Account controls unlocked');
  });

  it('aborts status polling and discards late results when locked or unmounted', async () => {
    let statusSignal: AbortSignal | undefined;
    let resolveStatus!: (response: Response) => void;
    await mountWith((input, init) => {
      if (String(input).endsWith('/capabilities')) {
        return Promise.resolve(json({ enabled: true, generationEnabled: false }));
      }
      statusSignal = init?.signal ?? undefined;
      return new Promise((resolve) => { resolveStatus = resolve; });
    });
    await unlock();
    expect(statusSignal?.aborted).toBe(false);

    button('Lock account controls').click();
    expect(statusSignal?.aborted).toBe(true);
    resolveStatus(json(signedIn));
    await flush();
    expect(host.textContent).not.toContain('listener@example.com');

    await unlock('second-token');
    expect(statusSignal?.aborted).toBe(false);
    app!.unmount();
    app = null;
    expect(statusSignal?.aborted).toBe(true);
  });

  it('allows locking an in-flight login and discovers the server attempt on the next unlock', async () => {
    let loginRequested = false;
    let resolveLogin!: (response: Response) => void;
    await mountWith((input) => {
      const url = String(input);
      if (url.endsWith('/capabilities')) return Promise.resolve(json({ enabled: true, generationEnabled: false }));
      if (url.endsWith('/account')) return Promise.resolve(json(loginRequested ? pending : signedOut));
      if (url.endsWith('/login')) {
        loginRequested = true;
        return new Promise((resolve) => { resolveLogin = resolve; });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    await unlock();
    await vi.waitFor(() => expect(host.textContent).toContain('No ChatGPT account is connected.'));
    button('Connect ChatGPT').click();
    await flush();

    button('Lock account controls').click();
    resolveLogin(json(pending));
    await flush();
    expect(host.textContent).not.toContain('ABCD-EFGH');

    await unlock('same-dedicated-token');
    await vi.waitFor(() => expect(host.textContent).toContain('ABCD-EFGH'));
  });

  it('serializes polling and ignores a late poll response after logout', async () => {
    vi.useFakeTimers();
    let accountRequests = 0;
    let resolveLatePoll!: (response: Response) => void;
    await mountWith((input) => {
      const url = String(input);
      if (url.endsWith('/capabilities')) return Promise.resolve(json({ enabled: true, generationEnabled: false }));
      if (url.endsWith('/account')) {
        accountRequests += 1;
        if (accountRequests === 1) return Promise.resolve(json(signedIn));
        return new Promise((resolve) => { resolveLatePoll = resolve; });
      }
      if (url.endsWith('/logout')) return Promise.resolve(json(signedOut));
      throw new Error(`Unexpected request: ${url}`);
    });
    await unlock();
    await flush();
    expect(host.textContent).toContain('listener@example.com');

    await vi.advanceTimersByTimeAsync(6_000);
    expect(accountRequests).toBe(2);

    button('Sign out').click();
    await flush();
    expect(host.textContent).toContain('No ChatGPT account is connected.');
    resolveLatePoll(json(signedIn));
    await flush();
    expect(host.textContent).not.toContain('listener@example.com');
  });

  it('forgets credentials on pagehide and a late poll cannot restore the pending account', async () => {
    vi.useFakeTimers();
    let accountRequests = 0;
    let lateSignal: AbortSignal | undefined;
    let resolveLatePoll!: (response: Response) => void;
    await mountWith((input, init) => {
      const url = String(input);
      if (url.endsWith('/capabilities')) return Promise.resolve(json({ enabled: true, generationEnabled: false }));
      accountRequests += 1;
      if (accountRequests === 1) return Promise.resolve(json(pending));
      lateSignal = init?.signal ?? undefined;
      return new Promise((resolve) => { resolveLatePoll = resolve; });
    });
    await unlock();
    await flush();
    expect(host.textContent).toContain('ABCD-EFGH');

    await vi.advanceTimersByTimeAsync(2_000);
    expect(lateSignal?.aborted).toBe(false);
    window.dispatchEvent(new Event('pagehide'));
    await nextTick();

    expect(lateSignal?.aborted).toBe(true);
    expect(host.querySelector<HTMLInputElement>('#codex-admin-token')?.value).toBe('');
    expect(host.textContent).not.toContain('ABCD-EFGH');
    resolveLatePoll(json(signedIn));
    await flush();
    expect(host.textContent).not.toContain('listener@example.com');
    expect(host.textContent).not.toContain('Account controls unlocked');
  });
});
