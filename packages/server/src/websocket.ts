import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import type {
  ClientMessage,
  ServerMessage,
  ServerZonesMessage,
  ServerNowPlayingMessage,
  ServerSeekMessage,
  ServerConnectionMessage,
  NowPlaying,
  Zone,
  LayoutType,
  FontType,
  BackgroundType,
  ClientMetadata,
  ServerClientsListMessage,
  ServerClientConnectedMessage,
  ServerClientDisconnectedMessage,
  ServerClientUpdatedMessage,
  ServerRemoteSettingsMessage,
} from '@roon-screen-cover/shared';
import { RoonClient } from './roon.js';
import { ExternalSourceManager } from './externalSources.js';
import { generateFriendlyName } from './nameGenerator.js';
import { logger } from './logger.js';

interface ClientState {
  ws: WebSocket;
  clientId: string; // Unique per connection (deviceId:sessionSuffix)
  deviceId: string; // Persistent device ID (for friendly name lookup)
  friendlyName: string | null;
  layout: LayoutType;
  font: FontType;
  background: BackgroundType;
  subscribedZoneId: string | null;
  subscribedZoneName: string | null;
  connectedAt: number;
  userAgent: string | null;
  isAdmin: boolean;
}

function extractDeviceId(clientId: string): string {
  // clientId format is "deviceId:sessionSuffix"
  const colonIndex = clientId.indexOf(':');
  return colonIndex > 0 ? clientId.slice(0, colonIndex) : clientId;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientState> = new Map();
  private clientsById: Map<string, ClientState> = new Map();
  private roonClient: RoonClient;
  private externalSourceManager: ExternalSourceManager | null = null;
  private friendlyNames: Map<string, string> = new Map();
  private onFriendlyNameChange?: (clientId: string, name: string | null) => void;

  constructor(server: Server, roonClient: RoonClient) {
    this.roonClient = roonClient;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.setupWebSocketServer();
    this.setupRoonListeners();
  }

  setExternalSourceManager(manager: ExternalSourceManager): void {
    this.externalSourceManager = manager;
    this.setupExternalSourceListeners();
  }

  setFriendlyNameChangeCallback(callback: (clientId: string, name: string | null) => void): void {
    this.onFriendlyNameChange = callback;
  }

  loadFriendlyNames(names: Map<string, string>): void {
    this.friendlyNames = names;
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const isAdmin = url.searchParams.get('admin') === 'true';
      const userAgent = req.headers['user-agent'] || null;

      logger.info(`New WebSocket connection (admin: ${isAdmin})`);

      const clientState: ClientState = {
        ws,
        clientId: '', // Will be set when client sends metadata
        deviceId: '', // Will be set when client sends metadata
        friendlyName: null,
        layout: 'detailed',
        font: 'system',
        background: 'black',
        subscribedZoneId: null,
        subscribedZoneName: null,
        connectedAt: Date.now(),
        userAgent,
        isAdmin,
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
        zones: this.getCombinedZones(),
      });

      // If admin, send current clients list
      if (isAdmin) {
        this.sendToClient(ws, {
          type: 'clients_list',
          clients: this.getAllClientsMetadata(),
        });
      }

      ws.on('message', (data: Buffer) => {
        this.handleClientMessage(ws, data);
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
        const state = this.clients.get(ws);
        if (state?.clientId) {
          this.clientsById.delete(state.clientId);
          // Notify admins about disconnection
          this.broadcastToAdmins({
            type: 'client_disconnected',
            clientId: state.clientId,
          });
        }
        this.clients.delete(ws);
      });

      ws.on('error', (error: Error) => {
        logger.error(`WebSocket error: ${error.message}`);
        const state = this.clients.get(ws);
        if (state?.clientId) {
          this.clientsById.delete(state.clientId);
        }
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

    this.roonClient.on('zones', () => {
      const message: ServerZonesMessage = {
        type: 'zones',
        zones: this.getCombinedZones(),
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

  private setupExternalSourceListeners(): void {
    if (!this.externalSourceManager) return;

    this.externalSourceManager.on('zones', () => {
      // Broadcast combined zones from both Roon and external sources
      this.broadcastToAll({
        type: 'zones',
        zones: this.getCombinedZones(),
      });
    });

    this.externalSourceManager.on('now_playing', (nowPlaying: NowPlaying) => {
      const message: ServerNowPlayingMessage = {
        type: 'now_playing',
        zone_id: nowPlaying.zone_id,
        state: nowPlaying.state,
        track: nowPlaying.track,
        seek_position: nowPlaying.seek_position,
      };
      this.broadcastToZoneSubscribers(nowPlaying.zone_id, message);
    });

    this.externalSourceManager.on('seek', (zoneId: string, position: number) => {
      const message: ServerSeekMessage = {
        type: 'seek',
        zone_id: zoneId,
        seek_position: position,
      };
      this.broadcastToZoneSubscribers(zoneId, message);
    });
  }

  private getCombinedZones(): Zone[] {
    const roonZones = this.roonClient.getZones();
    const externalZones = this.externalSourceManager?.getZones() || [];
    return [...roonZones, ...externalZones];
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
        case 'client_metadata':
          this.handleClientMetadata(clientState, message);
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

  private handleClientMetadata(
    clientState: ClientState,
    message: {
      clientId: string;
      layout: LayoutType;
      font: FontType;
      background: BackgroundType;
      zoneId: string | null;
      zoneName: string | null;
      userAgent: string | null;
      isAdmin?: boolean;
    }
  ): void {
    const isNewClient = !clientState.clientId;
    const oldClientId = clientState.clientId;

    // Extract device ID from client ID (format: "deviceId:sessionSuffix")
    const deviceId = extractDeviceId(message.clientId);

    // Update client state
    clientState.clientId = message.clientId;
    clientState.deviceId = deviceId;
    clientState.layout = message.layout;
    clientState.font = message.font;
    clientState.background = message.background;
    clientState.subscribedZoneId = message.zoneId;
    clientState.subscribedZoneName = message.zoneName;
    if (message.userAgent) {
      clientState.userAgent = message.userAgent;
    }
    if (message.isAdmin !== undefined) {
      clientState.isAdmin = message.isAdmin;
    }

    // Load or auto-generate friendly name (keyed by deviceId for persistence)
    const storedName = this.friendlyNames.get(deviceId);
    if (storedName) {
      clientState.friendlyName = storedName;
    } else {
      const existingNames = new Set(this.friendlyNames.values());
      const generated = generateFriendlyName(existingNames);
      clientState.friendlyName = generated;
      this.friendlyNames.set(deviceId, generated);
      if (this.onFriendlyNameChange) {
        this.onFriendlyNameChange(deviceId, generated);
      }
      logger.info(`Auto-assigned friendly name: ${generated} to device ${deviceId}`);
    }

    // Update clientsById map
    if (oldClientId && oldClientId !== message.clientId) {
      this.clientsById.delete(oldClientId);
    }
    this.clientsById.set(message.clientId, clientState);

    logger.info(
      `Client metadata: ${message.clientId} (${clientState.friendlyName || 'unnamed'}) - ` +
        `layout: ${message.layout}, zone: ${message.zoneName || 'none'}`
    );

    // Send friendly name to the client
    this.sendToClient(clientState.ws, {
      type: 'connection',
      status: 'connected',
      roon_connected: this.roonClient.isConnected(),
      friendly_name: clientState.friendlyName ?? undefined,
    });

    // Notify admins
    if (isNewClient) {
      this.broadcastToAdmins({
        type: 'client_connected',
        client: this.getClientMetadata(clientState),
      });
    } else {
      this.broadcastToAdmins({
        type: 'client_updated',
        client: this.getClientMetadata(clientState),
      });
    }
  }

  private handleSubscribe(clientState: ClientState, zoneId: string): void {
    clientState.subscribedZoneId = zoneId;

    // Find zone name from either Roon or external sources
    let zone = this.roonClient.getZones().find((z) => z.id === zoneId);
    if (!zone && this.externalSourceManager) {
      zone = this.externalSourceManager.getZones().find((z) => z.id === zoneId);
    }
    clientState.subscribedZoneName = zone?.display_name || null;

    logger.info(`Client subscribed to zone: ${zoneId}`);

    // Send current now_playing state for the zone
    let nowPlaying = this.roonClient.getNowPlaying(zoneId);
    if (!nowPlaying && this.externalSourceManager) {
      nowPlaying = this.externalSourceManager.getNowPlaying(zoneId);
    }
    if (nowPlaying) {
      this.sendToClient(clientState.ws, {
        type: 'now_playing',
        zone_id: nowPlaying.zone_id,
        state: nowPlaying.state,
        track: nowPlaying.track,
        seek_position: nowPlaying.seek_position,
      });
    }

    // Notify admins about the update
    if (clientState.clientId) {
      this.broadcastToAdmins({
        type: 'client_updated',
        client: this.getClientMetadata(clientState),
      });
    }
  }

  private handleUnsubscribe(clientState: ClientState): void {
    logger.info(`Client unsubscribed from zone: ${clientState.subscribedZoneId}`);
    clientState.subscribedZoneId = null;
    clientState.subscribedZoneName = null;

    // Notify admins about the update
    if (clientState.clientId) {
      this.broadcastToAdmins({
        type: 'client_updated',
        client: this.getClientMetadata(clientState),
      });
    }
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

  broadcastToAdmins(
    message:
      | ServerClientsListMessage
      | ServerClientConnectedMessage
      | ServerClientDisconnectedMessage
      | ServerClientUpdatedMessage
  ): void {
    const data = JSON.stringify(message);
    for (const clientState of this.clients.values()) {
      if (clientState.isAdmin && clientState.ws.readyState === WebSocket.OPEN) {
        clientState.ws.send(data);
      }
    }
  }

  private getClientMetadata(clientState: ClientState): ClientMetadata {
    return {
      clientId: clientState.clientId,
      friendlyName: clientState.friendlyName,
      layout: clientState.layout,
      font: clientState.font,
      background: clientState.background,
      zoneId: clientState.subscribedZoneId,
      zoneName: clientState.subscribedZoneName,
      connectedAt: clientState.connectedAt,
      userAgent: clientState.userAgent,
      isAdmin: clientState.isAdmin,
    };
  }

  getAllClientsMetadata(): ClientMetadata[] {
    const clients: ClientMetadata[] = [];
    for (const clientState of this.clients.values()) {
      // Only include clients that have sent metadata (have a clientId)
      if (clientState.clientId) {
        clients.push(this.getClientMetadata(clientState));
      }
    }
    return clients;
  }

  getClientById(clientId: string): ClientState | undefined {
    return this.clientsById.get(clientId);
  }

  pushSettingsToClient(
    clientId: string,
    settings: { layout?: LayoutType; font?: FontType; background?: BackgroundType; zoneId?: string }
  ): boolean {
    const clientState = this.clientsById.get(clientId);
    if (!clientState || clientState.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Find zone name if zoneId provided
    let zoneName: string | undefined;
    if (settings.zoneId) {
      let zone = this.roonClient.getZones().find((z) => z.id === settings.zoneId);
      if (!zone && this.externalSourceManager) {
        zone = this.externalSourceManager.getZones().find((z) => z.id === settings.zoneId);
      }
      zoneName = zone?.display_name;
    }

    const message: ServerRemoteSettingsMessage = {
      type: 'remote_settings',
      layout: settings.layout,
      font: settings.font,
      background: settings.background,
      zoneId: settings.zoneId,
      zoneName,
    };

    this.sendToClient(clientState.ws, message);

    // Update local state
    if (settings.layout) clientState.layout = settings.layout;
    if (settings.font) clientState.font = settings.font;
    if (settings.background) clientState.background = settings.background;
    if (settings.zoneId) {
      clientState.subscribedZoneId = settings.zoneId;
      clientState.subscribedZoneName = zoneName || null;
    }

    // Notify admins about the update
    this.broadcastToAdmins({
      type: 'client_updated',
      client: this.getClientMetadata(clientState),
    });

    return true;
  }

  setClientFriendlyName(clientId: string, name: string | null): boolean {
    const clientState = this.clientsById.get(clientId);
    if (!clientState) {
      return false;
    }

    const deviceId = clientState.deviceId;

    // Update in-memory state for this client
    clientState.friendlyName = name;

    // Also update any other connections from the same device
    for (const state of this.clients.values()) {
      if (state.deviceId === deviceId) {
        state.friendlyName = name;
      }
    }

    // Update friendly names map (keyed by deviceId)
    if (name) {
      this.friendlyNames.set(deviceId, name);
    } else {
      this.friendlyNames.delete(deviceId);
    }

    // Notify callback for persistence
    if (this.onFriendlyNameChange) {
      this.onFriendlyNameChange(deviceId, name);
    }

    // Notify admins about updated clients
    this.broadcastToAdmins({
      type: 'client_updated',
      client: this.getClientMetadata(clientState),
    });

    return true;
  }

  getConnectedClientCount(): number {
    return this.clients.size;
  }

  getZones(): Zone[] {
    return this.getCombinedZones();
  }

  getClientByFriendlyName(name: string): ClientMetadata | null {
    for (const state of this.clients.values()) {
      if (state.friendlyName === name) {
        return this.getClientMetadata(state);
      }
    }
    return null;
  }
}
