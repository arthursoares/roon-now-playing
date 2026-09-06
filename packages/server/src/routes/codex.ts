import { Router, type Request, type Response } from 'express';
import type { CodexAccountStatus } from '@roon-screen-cover/shared';
import type { CodexAuthService } from '../codexAuth.js';

type AccountService = Pick<CodexAuthService, 'getStatus' | 'startLogin' | 'cancelLogin' | 'logout'>;

/** Reject cross-origin browser requests; HTTPS reverse proxies keep the same Host. */
export function requireCodexSameOrigin(req: Request, res: Response): boolean {
  const origin = req.get('Origin');
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.host !== req.get('Host') || url.origin !== origin) {
      throw new Error('Origin mismatch');
    }
  } catch {
    res.status(403).json({ error: 'Forbidden', message: 'Account controls require a same-origin request.' });
    return false;
  }
  return true;
}

export function createCodexAccountRouter(options: {
  service: AccountService | null;
  generationEnabled?: boolean;
}): Router {
  const router = Router();
  const { service } = options;
  const enabled = service !== null;

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  // No subprocess is started and no account details are exposed by discovery.
  router.get('/capabilities', (_req, res) => {
    res.json({ enabled, generationEnabled: enabled && options.generationEnabled === true });
  });

  router.use((req, res, next) => {
    if (!enabled) {
      res.status(503).json({ error: 'Unavailable', message: 'ChatGPT account connection is not configured.' });
      return;
    }
    if (!requireCodexSameOrigin(req, res)) return;
    next();
  });

  async function respond(res: Response, operation: () => Promise<CodexAccountStatus>): Promise<void> {
    try {
      res.json(await operation());
    } catch {
      // Protocol errors can include secrets or subprocess details. Never relay them.
      res.status(503).json({ error: 'Unavailable', message: 'Unable to communicate with Codex. Please retry.' });
    }
  }

  function validBody(req: Request, res: Response, keys: string[]): boolean {
    const body: unknown = req.body ?? {};
    if (typeof body !== 'object' || body === null || Array.isArray(body)
      || Object.keys(body).some(key => !keys.includes(key))) {
      res.status(400).json({ error: 'Invalid request', message: 'Unexpected account request fields.' });
      return false;
    }
    return true;
  }

  router.get('/account', (_req, res) => respond(res, () => service!.getStatus()));
  router.post('/login', (req, res) => {
    if (validBody(req, res, [])) return respond(res, () => service!.startLogin());
  });
  router.post('/login/cancel', (req, res) => {
    if (!validBody(req, res, ['loginId'])) return;
    const loginId: unknown = req.body?.loginId;
    if (typeof loginId !== 'string' || !/^[\x21-\x7e]{1,256}$/.test(loginId)) {
      res.status(400).json({ error: 'Invalid request', message: 'A valid login attempt ID is required.' });
      return;
    }
    return respond(res, () => service!.cancelLogin(loginId));
  });
  router.post('/logout', (req, res) => {
    if (validBody(req, res, [])) return respond(res, () => service!.logout());
  });
  return router;
}
