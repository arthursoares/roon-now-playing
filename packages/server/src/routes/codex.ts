import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { CodexAccountStatus } from '@roon-screen-cover/shared';
import type { CodexAuthService } from '../codexAuth.js';

type AccountService = Pick<CodexAuthService, 'getStatus' | 'startLogin' | 'cancelLogin' | 'logout'>;

export function isValidCodexAdminToken(token: string | undefined): token is string {
  return typeof token === 'string' && /^[\x21-\x7e]{32,256}$/.test(token);
}

/** This bearer token protects Codex account controls only, not the entire app. */
export function createCodexAccountRouter(options: {
  service: AccountService | null;
  adminToken?: string;
}): Router {
  const router = Router();
  const { service, adminToken } = options;
  const enabled = service !== null && isValidCodexAdminToken(adminToken);
  const expectedHash = enabled ? createHash('sha256').update(adminToken!).digest() : null;

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.vary('Authorization');
    next();
  });

  // No subprocess is started and no account details are exposed by discovery.
  router.get('/capabilities', (_req, res) => {
    res.json({ enabled, generationEnabled: false });
  });

  router.use((req, res, next) => {
    if (!enabled || !expectedHash) {
      res.status(503).json({ error: 'Unavailable', message: 'ChatGPT account connection is not configured.' });
      return;
    }
    const authorization = req.get('Authorization') ?? '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (supplied.length > 256 || !timingSafeEqual(
      createHash('sha256').update(supplied).digest(), expectedHash,
    )) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing account administrator token.' });
      return;
    }

    // Cookie-free authorization already prevents ambient CSRF. Also reject
    // cross-origin browser requests; HTTPS reverse proxies keep the same Host.
    const origin = req.get('Origin');
    if (origin) {
      try {
        const url = new URL(origin);
        if (!['http:', 'https:'].includes(url.protocol) || url.host !== req.get('Host') || url.origin !== origin) {
          throw new Error('Origin mismatch');
        }
      } catch {
        res.status(403).json({ error: 'Forbidden', message: 'Account controls require a same-origin request.' });
        return;
      }
    }
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
