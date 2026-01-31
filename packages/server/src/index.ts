import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRoonClient } from './roon.js';
import { WebSocketManager } from './websocket.js';
import { createArtworkRouter } from './artwork.js';
import { createAdminRouter } from './admin.js';
import { createFactsRouter } from './facts.js';
import { ClientNameStore } from './clientNames.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main(): Promise<void> {
  const app = express();
  const server = createServer(app);

  // Initialize Roon client
  const roonClient = getRoonClient();

  // Initialize client name store
  const clientNameStore = new ClientNameStore();

  // Initialize WebSocket manager
  const wsManager = new WebSocketManager(server, roonClient);

  // Load saved friendly names into WebSocket manager
  wsManager.loadFriendlyNames(clientNameStore.getAll());

  // Set up persistence callback for name changes
  wsManager.setFriendlyNameChangeCallback((clientId, name) => {
    clientNameStore.set(clientId, name);
  });

  // API routes
  app.use(express.json());
  app.use('/api', createArtworkRouter(roonClient));
  app.use('/api/admin', createAdminRouter(wsManager));
  app.use('/api', createFactsRouter());

  // Zones endpoint
  app.get('/api/zones', (_req, res) => {
    res.json({
      zones: roonClient.getZones(),
      connected: roonClient.isConnected(),
    });
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      roon_connected: roonClient.isConnected(),
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

  // Start Roon discovery
  roonClient.start();

  // Start HTTP server
  server.listen(PORT, HOST, () => {
    logger.info(`Server running at http://${HOST}:${PORT}`);
    logger.info('Waiting for Roon Core pairing...');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  logger.error(`Failed to start server: ${error}`);
  process.exit(1);
});
