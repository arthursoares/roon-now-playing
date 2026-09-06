import { createServer } from 'node:http';
import { fileURLToPath, URL } from 'node:url';
import { afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createViteServer, loadConfigFromFile } from 'vite';

let upstream;
let vite;
afterEach(async () => {
  await vite?.close();
  if (upstream) await new Promise(resolve => upstream.close(resolve));
});

it('preserves the browser origin and host through every protected subscription endpoint', async () => {
  upstream = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ host: req.headers.host, origin: req.headers.origin }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const target = `http://127.0.0.1:${upstream.address().port}`;
  const loaded = await loadConfigFromFile(
    { command: 'serve', mode: 'development' }, fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  );
  const proxy = Object.fromEntries(Object.entries(loaded.config.server.proxy)
    .filter(([prefix]) => prefix.startsWith('/api'))
    .map(([prefix, options]) => [prefix, { ...(typeof options === 'string' ? {} : options), target }]));
  vite = await createViteServer({
    configFile: false,
    envFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, proxy },
  });
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  for (const endpoint of ['/api/codex/account', '/api/facts/config', '/api/facts/test']) {
    const response = await globalThis.fetch(`${origin}${endpoint}`, { headers: { Origin: origin } });
    assert.deepEqual(await response.json(), { host: new URL(origin).host, origin });
  }
});
