import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type {
  ClientMessage,
  ServerMessage,
  ServerZonesMessage,
  ServerNowPlayingMessage,
  ServerSeekMessage,
  ServerConnectionMessage,
  NowPlaying,
  Zone,
} from '@roon-screen-cover/shared';
import { RoonClient } from './roon.js';
import { logger } from './logger.js';

interface ClientState {
  ws: WebSocket;
  subscribedZoneId: string | null;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientState> = new Map();
  private roonClient: RoonClient;

  constructor(server: Server, roonClient: RoonClient) {
    this.roonClient = roonClient;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.setupWebSocketServer();
    this.setupRoonListeners();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('New WebSocket connection');

      const clientState: ClientState = {
        ws,
        subscribedZoneId: null,
      };
      this.clients.set(ws, clientState);

      // Send current connection status
      this.sendToClient(ws, {
        type: 'connection',
        status: 'connected',
        roon_connected: this.roonClient.isConnected(),
      });

      // Send current zones list
      this.sendToClient(ws, {
        type: 'zones',
        zones: this.roonClient.getZones(),
      });

      ws.on('message', (data: Buffer) => {
        this.handleClientMessage(ws, data);
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
        this.clients.delete(ws);
      });

      ws.on('error', (error: Error) => {
        logger.error(`WebSocket error: ${error.message}`);
        this.clients.delete(ws);
      });
    });
  }

  private setupRoonListeners(): void {
    this.roonClient.on('connected', () => {
      logger.info('Roon connected, notifying clients');
      this.broadcastToAll({
        type: 'connection',
        status: 'connected',
        roon_connected: true,
      });
    });

    this.roonClient.on('disconnected', () => {
      logger.info('Roon disconnected, notifying clients');
      this.broadcastToAll({
        type: 'connection',
        status: 'connected',
        roon_connected: false,
      });
    });

    this.roonClient.on('zones', (zones: Zone[]) => {
      const message: ServerZonesMessage = {
        type: 'zones',
        zones,
      };
      this.broadcastToAll(message);
    });

    this.roonClient.on('now_playing', (nowPlaying: NowPlaying) => {
      const message: ServerNowPlayingMessage = {
        type: 'now_playing',
        zone_id: nowPlaying.zone_id,
        state: nowPlaying.state,
        track: nowPlaying.track,
        seek_position: nowPlaying.seek_position,
      };
      this.broadcastToZoneSubscribers(nowPlaying.zone_id, message);
    });

    this.roonClient.on('seek', (zoneId: string, position: number) => {
      const message: ServerSeekMessage = {
        type: 'seek',
        zone_id: zoneId,
        seek_position: position,
      };
      this.broadcastToZoneSubscribers(zoneId, message);
    });
  }

  private handleClientMessage(ws: WebSocket, data: Buffer): void {
    const clientState = this.clients.get(ws);
    if (!clientState) return;

    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      logger.debug(`Received message: ${message.type}`);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientState, message.zone_id);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientState);
          break;
        default:
          logger.warn(`Unknown message type: ${(message as { type: string }).type}`);
      }
    } catch (error) {
      logger.error(`Failed to parse client message: ${error}`);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format',
      });
    }
  }

  private handleSubscribe(clientState: ClientState, zoneId: string): void {
    clientState.subscribedZoneId = zoneId;
    logger.info(`Client subscribed to zone: ${zoneId}`);

    // Send current now_playing state for the zone
    const nowPlaying = this.roonClient.getNowPlaying(zoneId);
    if (nowPlaying) {
      this.sendToClient(clientState.ws, {
        type: 'now_playing',
        zone_id: nowPlaying.zone_id,
        state: nowPlaying.state,
        track: nowPlaying.track,
        seek_position: nowPlaying.seek_position,
      });
    }
  }

  private handleUnsubscribe(clientState: ClientState): void {
    logger.info(`Client unsubscribed from zone: ${clientState.subscribedZoneId}`);
    clientState.subscribedZoneId = null;
  }

  private sendToClient(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToAll(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const clientState of this.clients.values()) {
      if (clientState.ws.readyState === WebSocket.OPEN) {
        clientState.ws.send(data);
      }
    }
  }

  private broadcastToZoneSubscribers(zoneId: string, message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const clientState of this.clients.values()) {
      if (
        clientState.subscribedZoneId === zoneId &&
        clientState.ws.readyState === WebSocket.OPEN
      ) {
        clientState.ws.send(data);
      }
    }
  }

  getConnectedClientCount(): number {
    return this.clients.size;
  }
}
