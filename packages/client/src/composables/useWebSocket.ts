import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import type {
  ServerMessage,
  ClientMessage,
  ClientMetadataMessage,
  Zone,
  NowPlaying,
  LayoutType,
  FontType,
  ClientMetadata,
} from '@roon-screen-cover/shared';
import { useClientId } from './useClientId';

export interface WebSocketState {
  connected: boolean;
  roonConnected: boolean;
  zones: Zone[];
  nowPlaying: NowPlaying | null;
  // Admin-only state
  clients: ClientMetadata[];
}

export interface RemoteSettingsHandler {
  onRemoteSettings?: (settings: {
    layout?: LayoutType;
    font?: FontType;
    zoneId?: string;
    zoneName?: string;
  }) => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export interface UseWebSocketOptions {
  isAdmin?: boolean;
  layout?: Ref<LayoutType>;
  font?: Ref<FontType>;
  zoneId?: Ref<string | null>;
  zoneName?: Ref<string | null>;
  onRemoteSettings?: (settings: {
    layout?: LayoutType;
    font?: FontType;
    zoneId?: string;
    zoneName?: string;
  }) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const clientId = useClientId();

  const state = ref<WebSocketState>({
    connected: false,
    roonConnected: false,
    zones: [],
    nowPlaying: null,
    clients: [],
  });

  let ws: WebSocket | null = null;
  let reconnectAttempt = 0;
  let reconnectTimeout: number | null = null;
  let subscribedZoneId: string | null = null;
  let subscribedZoneName: string | null = null;

  function getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const adminParam = options.isAdmin ? '?admin=true' : '';
    return `${protocol}//${window.location.host}/ws${adminParam}`;
  }

  function sendMetadata(): void {
    if (ws?.readyState !== WebSocket.OPEN) return;

    const metadata: ClientMetadataMessage = {
      type: 'client_metadata',
      clientId,
      layout: options.layout?.value || 'detailed',
      font: options.font?.value || 'system',
      zoneId: subscribedZoneId,
      zoneName: subscribedZoneName,
      userAgent: navigator.userAgent,
      isAdmin: options.isAdmin,
    };

    ws.send(JSON.stringify(metadata));
  }

  function connect(): void {
    if (ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const url = getWebSocketUrl();
    console.log(`[WS] Connecting to ${url}`);
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WS] Connected');
      state.value.connected = true;
      reconnectAttempt = 0;

      // Send initial metadata
      sendMetadata();

      // Re-subscribe to zone if we had one
      if (subscribedZoneId) {
        subscribeToZone(subscribedZoneId, subscribedZoneName || undefined);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      state.value.connected = false;
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    ws.onmessage = (event) => {
      handleMessage(event.data);
    };
  }

  function scheduleReconnect(): void {
    if (reconnectTimeout) {
      return;
    }

    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})`);

    reconnectTimeout = window.setTimeout(() => {
      reconnectTimeout = null;
      reconnectAttempt++;
      connect();
    }, delay);
  }

  function handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ServerMessage;

      switch (message.type) {
        case 'connection':
          state.value.roonConnected = message.roon_connected;
          break;

        case 'zones':
          state.value.zones = message.zones;
          break;

        case 'now_playing':
          state.value.nowPlaying = {
            zone_id: message.zone_id,
            state: message.state,
            track: message.track,
            seek_position: message.seek_position,
          };
          break;

        case 'seek':
          if (state.value.nowPlaying && state.value.nowPlaying.zone_id === message.zone_id) {
            state.value.nowPlaying.seek_position = message.seek_position;
          }
          break;

        case 'error':
          console.error('[WS] Server error:', message.message);
          break;

        // Admin-only messages
        case 'clients_list':
          state.value.clients = message.clients;
          break;

        case 'client_connected':
          state.value.clients = [...state.value.clients, message.client];
          break;

        case 'client_disconnected':
          state.value.clients = state.value.clients.filter((c) => c.clientId !== message.clientId);
          break;

        case 'client_updated':
          state.value.clients = state.value.clients.map((c) =>
            c.clientId === message.client.clientId ? message.client : c
          );
          break;

        // Remote settings from admin
        case 'remote_settings':
          console.log('[WS] Received remote settings:', message);
          if (options.onRemoteSettings) {
            options.onRemoteSettings({
              layout: message.layout,
              font: message.font,
              zoneId: message.zoneId,
              zoneName: message.zoneName,
            });
          }
          break;
      }
    } catch (error) {
      console.error('[WS] Failed to parse message:', error);
    }
  }

  function send(message: ClientMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function subscribeToZone(zoneId: string, zoneName?: string): void {
    subscribedZoneId = zoneId;
    subscribedZoneName = zoneName || null;
    send({ type: 'subscribe', zone_id: zoneId });
    // Update metadata to reflect zone change
    sendMetadata();
  }

  function unsubscribe(): void {
    subscribedZoneId = null;
    subscribedZoneName = null;
    state.value.nowPlaying = null;
    send({ type: 'unsubscribe' });
    // Update metadata to reflect zone change
    sendMetadata();
  }

  function updateMetadata(): void {
    sendMetadata();
  }

  function disconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    state,
    clientId,
    subscribeToZone,
    unsubscribe,
    updateMetadata,
    connect,
    disconnect,
  };
}
