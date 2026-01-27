import { ref, onMounted, onUnmounted } from 'vue';
import type {
  ServerMessage,
  ClientMessage,
  Zone,
  NowPlaying,
  PlaybackState,
  Track,
} from '@roon-screen-cover/shared';

export interface WebSocketState {
  connected: boolean;
  roonConnected: boolean;
  zones: Zone[];
  nowPlaying: NowPlaying | null;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export function useWebSocket() {
  const state = ref<WebSocketState>({
    connected: false,
    roonConnected: false,
    zones: [],
    nowPlaying: null,
  });

  let ws: WebSocket | null = null;
  let reconnectAttempt = 0;
  let reconnectTimeout: number | null = null;
  let subscribedZoneId: string | null = null;

  function getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
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

      // Re-subscribe to zone if we had one
      if (subscribedZoneId) {
        subscribeToZone(subscribedZoneId);
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

  function subscribeToZone(zoneId: string): void {
    subscribedZoneId = zoneId;
    send({ type: 'subscribe', zone_id: zoneId });
  }

  function unsubscribe(): void {
    subscribedZoneId = null;
    state.value.nowPlaying = null;
    send({ type: 'unsubscribe' });
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
    subscribeToZone,
    unsubscribe,
    connect,
    disconnect,
  };
}
