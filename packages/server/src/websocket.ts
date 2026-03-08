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
  DisplaySettings,
  ServerClientResetMessage,
} from '@roon-screen-cover/shared';
import { RoonClient } from './roon.js';
import { ExternalSourceManager } from './externalSources.js';
import { generateFriendlyName } from './nameGenerator.js';
import { logger } from './logger.js';
import { loadDisplaySettings } from './display-settings.js';
import type { ClientSettingsStore, ClientSettings } from './clientSettings.js';

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
  fontScaleOverride?: number | null;
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
  private roonClient: RoonClient | null;
  private externalSourceManager: ExternalSourceManager | null = null;
  private clientSettingsStore: ClientSettingsStore | null = null;
  private friendlyNames: Map<string, string> = new Map();
  private onFriendlyNameChange?: (clientId: string, name: string | null) => void;

  constructor(server: Server, roonClient: RoonClient | null) {
    this.roonClient = roonClient;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.setupWebSocketServer();
    if (this.roonClient) {
      this.setupRoonListeners();
    }
  }

  setExternalSourceManager(manager: ExternalSourceManager): void {
    this.externalSourceManager = manager;
    this.setupExternalSourceListeners();
  }

  setClientSettingsStore(store: ClientSettingsStore): void {
    this.clientSettingsStore = store;
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
        roon_connected: this.roonClient?.isConnected() ?? false,
        roon_enabled: this.roonClient !== null,
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
      } else {
        // For non-admin clients, send current display settings
        const displaySettings = loadDisplaySettings();
        this.sendToClient(ws, {
          type: 'display_settings_update',
          settings: displaySettings,
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
        }
        this.clients.delete(ws);

        // Only notify admins if no other connections remain for this device
        if (state?.deviceId && !this.hasActiveConnectionsForDevice(state.deviceId)) {
          this.broadcastToAdmins({
            type: 'client_disconnected',
            clientId: state.clientId,
          });
        } else if (state?.deviceId) {
          // Another connection exists — send an update with the remaining one
          const remaining = this.getLatestClientForDevice(state.deviceId);
          if (remaining) {
            this.broadcastToAdmins({
              type: 'client_updated',
              client: this.getClientMetadata(remaining),
            });
          }
        }
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
    this.roonClient!.on('connected', () => {
      logger.info('Roon connected, notifying clients');
      this.broadcastToAll({
        type: 'connection',
        status: 'connected',
        roon_connected: true,
        roon_enabled: true,
      });
    });

    this.roonClient!.on('disconnected', () => {
      logger.info('Roon disconnected, notifying clients');
      this.broadcastToAll({
        type: 'connection',
        status: 'connected',
        roon_connected: false,
        roon_enabled: true,
      });
    });

    this.roonClient!.on('zones', () => {
      const message: ServerZonesMessage = {
        type: 'zones',
        zones: this.getCombinedZones(),
      };
      this.broadcastToAll(message);
    });

    this.roonClient!.on('now_playing', (nowPlaying: NowPlaying) => {
      const message: ServerNowPlayingMessage = {
        type: 'now_playing',
        zone_id: nowPlaying.zone_id,
        state: nowPlaying.state,
        track: nowPlaying.track,
        seek_position: nowPlaying.seek_position,
      };
      this.broadcastToZoneSubscribers(nowPlaying.zone_id, message);
    });

    this.roonClient!.on('seek', (zoneId: string, position: number) => {
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
    const roonZones = this.roonClient?.getZones() ?? [];
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

    // Persist client settings
    if (this.clientSettingsStore) {
      this.clientSettingsStore.set(deviceId, {
        layout: clientState.layout,
        font: clientState.font,
        background: clientState.background,
        zoneId: clientState.subscribedZoneId,
        zoneName: clientState.subscribedZoneName,
        fontScaleOverride: clientState.fontScaleOverride ?? null,
      });
    }

    logger.info(
      `Client metadata: ${message.clientId} (${clientState.friendlyName || 'unnamed'}) - ` +
        `layout: ${message.layout}, zone: ${message.zoneName || 'none'}`
    );

    // Send friendly name to the client
    this.sendToClient(clientState.ws, {
      type: 'connection',
      status: 'connected',
      roon_connected: this.roonClient?.isConnected() ?? false,
      roon_enabled: this.roonClient !== null,
      friendly_name: clientState.friendlyName ?? undefined,
    });

    // On first connect, push server-stored settings if they differ from what client sent
    if (isNewClient && this.clientSettingsStore) {
      const storedSettings = this.clientSettingsStore.get(deviceId);
      if (storedSettings) {
        const needsPush =
          storedSettings.layout !== clientState.layout ||
          storedSettings.font !== clientState.font ||
          storedSettings.background !== clientState.background ||
          storedSettings.zoneId !== clientState.subscribedZoneId ||
          storedSettings.fontScaleOverride !== (clientState.fontScaleOverride ?? null);

        if (needsPush) {
          this.sendToClient(clientState.ws, {
            type: 'remote_settings',
            layout: storedSettings.layout,
            font: storedSettings.font,
            background: storedSettings.background,
            zoneId: storedSettings.zoneId ?? undefined,
            zoneName: storedSettings.zoneName ?? undefined,
            fontScaleOverride: storedSettings.fontScaleOverride,
          } as ServerRemoteSettingsMessage);

          // Update local state to match
          clientState.layout = storedSettings.layout;
          clientState.font = storedSettings.font;
          clientState.background = storedSettings.background;
          clientState.subscribedZoneId = storedSettings.zoneId;
          clientState.subscribedZoneName = storedSettings.zoneName;
          clientState.fontScaleOverride = storedSettings.fontScaleOverride;
        }
      }
    }

    // Notify admins — only send client_connected if this device has no other connections
    const isNewDevice = isNewClient && !this.hasOtherConnectionsForDevice(deviceId, message.clientId);
    if (isNewDevice) {
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
    let zone = this.roonClient?.getZones().find((z) => z.id === zoneId);
    if (!zone && this.externalSourceManager) {
      zone = this.externalSourceManager.getZones().find((z) => z.id === zoneId);
    }
    clientState.subscribedZoneName = zone?.display_name || null;

    logger.info(`Client subscribed to zone: ${zoneId}`);

    // Send current now_playing state for the zone
    let nowPlaying = this.roonClient?.getNowPlaying(zoneId) ?? null;
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
      fontScaleOverride: clientState.fontScaleOverride,
    };
  }

  getAllClientsMetadata(): ClientMetadata[] {
    // Deduplicate by deviceId — keep the most recently connected per device
    const byDevice = new Map<string, ClientState>();
    for (const clientState of this.clients.values()) {
      if (!clientState.clientId || !clientState.deviceId) continue;
      const existing = byDevice.get(clientState.deviceId);
      if (!existing || clientState.connectedAt > existing.connectedAt) {
        byDevice.set(clientState.deviceId, clientState);
      }
    }
    return Array.from(byDevice.values()).map((s) => this.getClientMetadata(s));
  }

  getClientById(clientId: string): ClientState | undefined {
    return this.clientsById.get(clientId);
  }

  private hasOtherConnectionsForDevice(deviceId: string, excludeClientId: string): boolean {
    for (const state of this.clients.values()) {
      if (state.deviceId === deviceId && state.clientId && state.clientId !== excludeClientId) {
        return true;
      }
    }
    return false;
  }

  private hasActiveConnectionsForDevice(deviceId: string): boolean {
    for (const state of this.clients.values()) {
      if (state.deviceId === deviceId) return true;
    }
    return false;
  }

  private getLatestClientForDevice(deviceId: string): ClientState | undefined {
    let latest: ClientState | undefined;
    for (const state of this.clients.values()) {
      if (state.deviceId === deviceId && state.clientId) {
        if (!latest || state.connectedAt > latest.connectedAt) {
          latest = state;
        }
      }
    }
    return latest;
  }

  private getAllConnectionsForDevice(deviceId: string): ClientState[] {
    const connections: ClientState[] = [];
    for (const state of this.clients.values()) {
      if (state.deviceId === deviceId && state.clientId) {
        connections.push(state);
      }
    }
    return connections;
  }

  pushSettingsToClient(
    clientId: string,
    settings: { layout?: LayoutType; font?: FontType; background?: BackgroundType; zoneId?: string; fontScaleOverride?: number | null }
  ): boolean {
    const clientState = this.clientsById.get(clientId);
    if (!clientState) {
      return false;
    }

    // Find zone name if zoneId provided
    let zoneName: string | undefined;
    if (settings.zoneId) {
      let zone = this.roonClient?.getZones().find((z) => z.id === settings.zoneId);
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
      fontScaleOverride: settings.fontScaleOverride,
    };

    // Push to ALL connections from this device
    const deviceConnections = this.getAllConnectionsForDevice(clientState.deviceId);
    let anySent = false;
    for (const conn of deviceConnections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(conn.ws, message);
        anySent = true;
      }
      // Update local state for all connections
      if (settings.layout) conn.layout = settings.layout;
      if (settings.font) conn.font = settings.font;
      if (settings.background) conn.background = settings.background;
      if (settings.zoneId) {
        conn.subscribedZoneId = settings.zoneId;
        conn.subscribedZoneName = zoneName || null;
      }
      if (settings.fontScaleOverride !== undefined) {
        conn.fontScaleOverride = settings.fontScaleOverride;
      }
    }

    if (!anySent) return false;

    // Persist to settings store
    if (this.clientSettingsStore) {
      this.clientSettingsStore.set(clientState.deviceId, {
        layout: clientState.layout,
        font: clientState.font,
        background: clientState.background,
        zoneId: clientState.subscribedZoneId,
        zoneName: clientState.subscribedZoneName,
        fontScaleOverride: clientState.fontScaleOverride ?? null,
      });
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

  removeClient(clientId: string): boolean {
    const clientState = this.clientsById.get(clientId);
    if (!clientState) return false;

    const deviceId = clientState.deviceId;

    // Delete stored settings and friendly name
    if (this.clientSettingsStore) {
      this.clientSettingsStore.delete(deviceId);
    }
    this.friendlyNames.delete(deviceId);
    if (this.onFriendlyNameChange) {
      this.onFriendlyNameChange(deviceId, null);
    }

    // Send reset to all connections from this device, then close them
    const deviceConnections = this.getAllConnectionsForDevice(deviceId);
    for (const conn of deviceConnections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(conn.ws, { type: 'client_reset' } as ServerClientResetMessage);
        conn.ws.close();
      }
      this.clientsById.delete(conn.clientId);
      this.clients.delete(conn.ws);
    }

    // Notify admins
    this.broadcastToAdmins({
      type: 'client_disconnected',
      clientId,
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

  broadcastDisplaySettings(settings: DisplaySettings): void {
    const message = JSON.stringify({
      type: 'display_settings_update',
      settings,
    });

    // Broadcast to all non-admin clients
    for (const clientState of this.clients.values()) {
      if (!clientState.isAdmin && clientState.ws.readyState === WebSocket.OPEN) {
        clientState.ws.send(message);
      }
    }
  }
}
