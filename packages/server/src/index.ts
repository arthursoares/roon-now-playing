import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRoonClient, isRoonEnabled } from './roon.js';
import { WebSocketManager } from './websocket.js';
import { createArtworkRouter } from './artwork.js';
import { createAdminRouter } from './admin.js';
import { createFactsRouter } from './facts.js';
import { ClientNameStore } from './clientNames.js';
import { ClientSettingsStore } from './clientSettings.js';
import { logger } from './logger.js';
import { ExternalSourceManager } from './externalSources.js';
import { SourcesConfigStore } from './sourcesConfig.js';
import { createSourcesRouter } from './routes/sources.js';
import { cacheBase64Artwork, cacheExternalArtwork } from './artwork.js';
import { AlbumHistoryStore } from './albumHistory.js';
import { CodexAuthService } from './codexAuth.js';
import { createCodexAccountRouter, isValidCodexAdminToken } from './routes/codex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main(): Promise<void> {
  const app = express();
  const server = createServer(app);
  const codexAdminToken = process.env.CODEX_ADMIN_TOKEN;
  const codexRequested = process.env.CODEX_ENABLED === 'true';
  const codexAuth = codexRequested && isValidCodexAdminToken(codexAdminToken)
    ? new CodexAuthService({
      homeDir: path.resolve(process.env.CODEX_ACCOUNT_DIR || path.join(process.env.DATA_DIR || './config', 'codex-account')),
      binaryPath: process.env.CODEX_BINARY || 'codex',
    })
    : null;
  if (codexRequested && !codexAuth) {
    logger.warn('ChatGPT account connection disabled: configure a dedicated CODEX_ADMIN_TOKEN (32-256 non-space ASCII characters).');
  }

  // Initialize Roon client
  const roonClient = getRoonClient();

  // Initialize client name store
  const clientNameStore = new ClientNameStore();

  // Initialize client settings store
  const clientSettingsStore = new ClientSettingsStore();

  // Initialize sources config store
  const sourcesConfigStore = new SourcesConfigStore();

  // Initialize external source manager
  const externalSourceManager = new ExternalSourceManager();
  externalSourceManager.setArtworkCallback(cacheExternalArtwork);
  externalSourceManager.setBase64ArtworkCallback(cacheBase64Artwork);

  // Initialize WebSocket manager
  const wsManager = new WebSocketManager(server, roonClient);

  // Load saved friendly names into WebSocket manager
  wsManager.loadFriendlyNames(clientNameStore.getAll());

  // Set up persistence callback for name changes
  wsManager.setFriendlyNameChangeCallback((clientId, name) => {
    clientNameStore.set(clientId, name);
  });

  // Wire client settings store for persistence
  wsManager.setClientSettingsStore(clientSettingsStore);
  wsManager.setAlbumHistoryStore(new AlbumHistoryStore());

  // Connect external source manager to WebSocket
  wsManager.setExternalSourceManager(externalSourceManager);

  // API routes. Raise the body limit above the 100kb default so external-source
  // pushers can include embedded artwork (base64 / data: URLs) in now-playing
  // payloads without hitting PayloadTooLargeError.
  app.use(express.json({ limit: '5mb' }));
  app.use('/api', createArtworkRouter(roonClient));
  app.use('/api/admin', createAdminRouter(wsManager));
  app.use('/api', createFactsRouter());
  app.use('/api/sources', createSourcesRouter(externalSourceManager, sourcesConfigStore));
  app.use('/api/codex', createCodexAccountRouter({ service: codexAuth, adminToken: codexAdminToken }));

  // Zones endpoint
  app.get('/api/zones', (_req, res) => {
    const roonZones = roonClient?.getZones().map(z => ({ ...z, source: 'roon' as const })) ?? [];
    const externalZones = externalSourceManager.getZones().map(z => ({ ...z, source: 'external' as const }));
    res.json({
      zones: [...roonZones, ...externalZones],
      connected: roonClient?.isConnected() ?? false,
      roon_enabled: isRoonEnabled(),
    });
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      roon_enabled: isRoonEnabled(),
      roon_connected: roonClient?.isConnected() ?? false,
      clients: wsManager.getConnectedClientCount(),
    });
  });

  // Serve static files from client build (in production)
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // SPA fallback - serve index.html for all non-API routes
  // Express 5 requires named wildcard parameters
  app.get('*splat', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) {
        // In development, client might not be built yet
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Roon Screen Cover</title></head>
            <body>
              <h1>Roon Screen Cover</h1>
              <p>Client not built. Run <code>pnpm build:client</code> or <code>pnpm dev</code></p>
            </body>
          </html>
        `);
      }
    });
  });

  // Start Roon discovery (only if enabled)
  if (roonClient) {
    roonClient.start();
  }

  // Start HTTP server
  server.listen(PORT, HOST, () => {
    logger.info(`Server running at http://${HOST}:${PORT}`);
    if (roonClient) {
      logger.info('Waiting for Roon Core pairing...');
    } else {
      logger.info('Roon integration disabled (ROON_ENABLED=false)');
    }
  });

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down...`);
    await codexAuth?.dispose();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

main().catch((error) => {
  logger.error(`Failed to start server: ${error}`);
  process.exit(1);
});
