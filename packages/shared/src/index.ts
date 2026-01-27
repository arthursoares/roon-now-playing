// Zone types
export interface Zone {
  id: string;
  display_name: string;
}

// Track types
export interface Track {
  title: string;
  artist: string;
  album: string;
  duration_seconds: number;
  artwork_key: string | null;
}

// Playback state
export type PlaybackState = 'playing' | 'paused' | 'stopped';

// Now Playing state
export interface NowPlaying {
  zone_id: string;
  state: PlaybackState;
  track: Track | null;
  seek_position: number;
}

// Layout options
export type LayoutType = 'minimal' | 'detailed' | 'fullscreen' | 'ambient';

// WebSocket message types
export interface ClientSubscribeMessage {
  type: 'subscribe';
  zone_id: string;
}

export interface ClientUnsubscribeMessage {
  type: 'unsubscribe';
}

export type ClientMessage = ClientSubscribeMessage | ClientUnsubscribeMessage;

export interface ServerZonesMessage {
  type: 'zones';
  zones: Zone[];
}

export interface ServerNowPlayingMessage {
  type: 'now_playing';
  zone_id: string;
  state: PlaybackState;
  track: Track | null;
  seek_position: number;
}

export interface ServerSeekMessage {
  type: 'seek';
  zone_id: string;
  seek_position: number;
}

export interface ServerErrorMessage {
  type: 'error';
  message: string;
}

export interface ServerConnectionMessage {
  type: 'connection';
  status: 'connected' | 'disconnected';
  roon_connected: boolean;
}

export type ServerMessage =
  | ServerZonesMessage
  | ServerNowPlayingMessage
  | ServerSeekMessage
  | ServerErrorMessage
  | ServerConnectionMessage;
